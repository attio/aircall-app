import {Workflows, kv} from "attio/server"
import {callEndedPayloadSchema} from "../../aircall-api/webhook-events"
import {createLogger} from "../../utils/logger"
import block from "./block"
import {buildAnswered, buildMissed} from "./lib/to-outcome"

const logger = createLogger("aircall-call-ended-trigger on-trigger-callback")

// Aircall retries deliveries up to 50x over 12h on non-2xx responses. We ack 2xx as soon as we've
// recorded the call, so retries stop immediately and a 4h dedup window comfortably absorbs any
// near-duplicate redelivery. Keyed by activation + call so distinct workflows each fire once.
const PROCESSED_LOCK_TTL = 60 * 60 * 4 // 4 hours

const lockKey = (uniqueActivationId: string, callId: number): string =>
    `aircall-call-ended-trigger-${uniqueActivationId}-${callId}`

export default Workflows.defineWorkflowBlockTrigger(block, async (req, {config, metadata}) => {
    const {uniqueActivationId} = metadata

    let body: unknown
    try {
        body = await req.json()
    } catch {
        logger.error("Failed to parse webhook payload", {uniqueActivationId})
        return {type: "no-op"}
    }

    const parsed = callEndedPayloadSchema.safeParse(body)
    if (!parsed.success) {
        logger.error("Unexpected call.ended payload", {uniqueActivationId})
        return {type: "no-op"}
    }

    const call = parsed.data.data

    // Optional single-number filter. Unset = match all. The configurator stores the Aircall
    // number id (from GET /v1/numbers); the webhook's call.number.id is the same id space, so
    // we match exactly on id rather than comparing fuzzy digit strings.
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

    // A call counts as answered when answered_at is set — including outbound calls picked up by
    // a voicemail box (Aircall has no answering-machine detection).
    if (call.answered_at != null) {
        logger.log("Firing answered outcome", {uniqueActivationId, callId: call.id})
        return {type: "outcome", id: "answered", data: buildAnswered(call)}
    }

    logger.log("Firing missed outcome", {uniqueActivationId, callId: call.id})
    return {type: "outcome", id: "missed", data: buildMissed(call)}
})
