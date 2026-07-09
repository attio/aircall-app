import {Workflows, kv} from "attio/server"
import {messageReceivedPayloadSchema} from "../../aircall-api/webhook-events"
import {createLogger} from "../../utils/logger"
import block from "./block"
import {buildReceived} from "./lib/to-outcome"

const logger = createLogger("aircall-message-received-trigger on-trigger-callback")

// Aircall retries deliveries up to 50x over 12h on non-2xx responses. We ack 2xx as soon as we've
// recorded the message, so retries stop immediately and a 4h dedup window comfortably absorbs any
// near-duplicate redelivery. Keyed by activation + message so distinct workflows each fire once.
const PROCESSED_LOCK_TTL = 60 * 60 * 4 // 4 hours

const lockKey = (uniqueActivationId: string, messageId: string): string =>
    `aircall-message-received-trigger-${uniqueActivationId}-${messageId}`

export default Workflows.defineWorkflowBlockTrigger(block, async (req, {config, metadata}) => {
    const {uniqueActivationId} = metadata

    let body: unknown
    try {
        body = await req.json()
    } catch {
        logger.error("Failed to parse webhook payload", {uniqueActivationId})
        return {type: "no-op"}
    }

    const parsed = messageReceivedPayloadSchema.safeParse(body)
    if (!parsed.success) {
        // `issues` carries the failing field paths (no message content) — enough to spot a
        // wire-shape drift without logging the payload body.
        logger.error("Unexpected message.received payload", {
            uniqueActivationId,
            issues: parsed.error.issues,
        })
        return {type: "no-op"}
    }

    const message = parsed.data.data

    // Optional single-number filter. Unset = match all. The configurator stores the Aircall
    // number id (from GET /v1/numbers); the webhook's data.number.id is the same id space, so
    // we match exactly on id rather than comparing fuzzy digit strings.
    if (config.numberId && String(message.number?.id ?? "") !== config.numberId) {
        logger.log("Skipping message on non-matching number", {
            uniqueActivationId,
            messageNumberId: message.number?.id,
        })
        return {type: "no-op"}
    }

    const key = lockKey(uniqueActivationId, message.id)
    const existing = await kv.get(key)
    if (existing?.value === "processed") {
        logger.log("Message already processed, skipping", {
            uniqueActivationId,
            messageId: message.id,
        })
        return {type: "no-op"}
    }
    await kv.set(key, "processed", {ttlInSeconds: PROCESSED_LOCK_TTL})

    logger.log("Firing received outcome", {uniqueActivationId, messageId: message.id})
    return {type: "outcome", id: "received", data: buildReceived(message)}
})
