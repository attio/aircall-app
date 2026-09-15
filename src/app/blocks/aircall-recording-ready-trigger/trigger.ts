import {Workflows, kv} from "attio/server"
import {callCommAssetsGeneratedPayloadSchema} from "../../../aircall-api/webhook-events"
import {createLogger} from "../../../utils/logger"
import block from "./block"
import {buildReady} from "./lib/to-outcome"

const logger = createLogger("aircall-recording-ready-trigger on-trigger-callback")

// Same redelivery/dedup rationale as the call-ended trigger: Aircall retries deliveries up to 50x
// over 12h on non-2xx responses. We ack 2xx as soon as we've recorded the event, so retries stop
// immediately and a 4h dedup window comfortably absorbs any near-duplicate redelivery.
const PROCESSED_LOCK_TTL = 60 * 60 * 4 // 4 hours

const lockKey = (uniqueActivationId: string, callId: number): string =>
    `aircall-recording-ready-trigger-${uniqueActivationId}-${callId}`

export default Workflows.defineWorkflowBlockTrigger(block, async (req, {config, metadata}) => {
    const {uniqueActivationId} = metadata

    let body: unknown
    try {
        body = await req.json()
    } catch {
        logger.error("Failed to parse webhook payload", {uniqueActivationId})
        return {type: "no-op"}
    }

    const parsed = callCommAssetsGeneratedPayloadSchema.safeParse(body)
    if (!parsed.success) {
        logger.error("Unexpected call.comm_assets_generated payload", {
            uniqueActivationId,
            issues: parsed.error.issues,
        })
        return {type: "no-op"}
    }

    const call = parsed.data.data

    if (config.numberId && String(call.number?.id ?? "") !== config.numberId) {
        return {type: "no-op"}
    }

    const key = lockKey(uniqueActivationId, call.id)
    const existing = await kv.get(key)
    if (existing?.value === "processed") {
        logger.log("Call already processed, skipping", {uniqueActivationId, callId: call.id})
        return {type: "no-op"}
    }
    await kv.set(key, "processed", {ttlInSeconds: PROCESSED_LOCK_TTL})

    const ready = buildReady(call)
    if (ready.type === "unrecognized") {
        logger.error("call.comm_assets_generated with neither recording nor voicemail", {
            uniqueActivationId,
            callId: call.id,
        })
        return {type: "no-op"}
    }

    logger.log(`Firing ${ready.type} outcome`, {uniqueActivationId, callId: call.id})
    return {type: "outcome", id: ready.type, data: ready.data}
})
