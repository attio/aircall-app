import {Workflows, kv} from "attio/server"
import {summaryCreatedPayloadSchema} from "../../../aircall-api/webhook-events"
import {createLogger} from "../../../utils/logger"
import block from "./block"
import {buildSummaryReady} from "./lib/to-outcome"

const logger = createLogger("aircall-call-summary-trigger on-trigger-callback")

// Same redelivery/dedup rationale as the other Aircall triggers: Aircall retries deliveries up to
// 50x over 12h on non-2xx responses. We ack 2xx as soon as we've recorded the event, so retries
// stop immediately and a 4h dedup window comfortably absorbs any near-duplicate redelivery.
const PROCESSED_LOCK_TTL = 60 * 60 * 4 // 4 hours

const lockKey = (uniqueActivationId: string, callId: number): string =>
    `aircall-call-summary-trigger-${uniqueActivationId}-${callId}`

export default Workflows.defineWorkflowBlockTrigger(block, async (req, {config, metadata}) => {
    const {uniqueActivationId} = metadata

    let body: unknown
    try {
        body = await req.json()
    } catch {
        logger.error("Failed to parse webhook payload", {uniqueActivationId})
        return {type: "no-op"}
    }

    const parsed = summaryCreatedPayloadSchema.safeParse(body)
    if (!parsed.success) {
        logger.error("Unexpected summary.created payload", {
            uniqueActivationId,
            issues: parsed.error.issues,
        })
        return {type: "no-op"}
    }

    const {data} = parsed.data

    // Optional single-number filter. Unset = match all. The configurator stores the Aircall
    // number id (from GET /v1/numbers); the webhook's data.number_id is the same id space, so
    // we match exactly on id rather than comparing fuzzy digit strings.
    if (config.numberId && String(data.number_id ?? "") !== config.numberId) {
        return {type: "no-op"}
    }

    const key = lockKey(uniqueActivationId, data.call_id)
    const existing = await kv.get(key)
    if (existing?.value === "processed") {
        logger.log("Summary already processed, skipping", {
            uniqueActivationId,
            callId: data.call_id,
        })
        return {type: "no-op"}
    }
    await kv.set(key, "processed", {ttlInSeconds: PROCESSED_LOCK_TTL})

    logger.log("Firing summary-ready outcome", {uniqueActivationId, callId: data.call_id})
    return {type: "outcome", id: "ready", data: buildSummaryReady(data)}
})
