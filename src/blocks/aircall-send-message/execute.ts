import {isErrored} from "@attio/fetchable"
import {Workflows} from "attio/server"
import {sendNativeMessage} from "../../aircall-api/messages"
import {createLogger} from "../../utils/logger"
import block from "./block"

const logger = createLogger("aircall-send-message execute")

const MAX_BODY_LENGTH = 1600

export default Workflows.defineWorkflowBlockExecute(block, async ({config}) => {
    const lineId = Number(config.lineId)
    if (!Number.isFinite(lineId)) {
        logger.error(`Invalid Aircall line ID: ${config.lineId}`)
        return {
            type: "error",
            errorMessage: `Invalid Aircall line ID: ${config.lineId}`,
            retryable: false,
        }
    }

    const to = config.to.normalized
    if (!to) {
        logger.error("No usable recipient phone number")
        return {
            type: "error",
            errorMessage: "No recipient phone number was provided.",
            retryable: false,
        }
    }

    const body = config.body
    if (body.trim().length === 0) {
        // Empty messages are an upstream binding bug, not a routing decision.
        return {type: "error", errorMessage: "Empty message body", retryable: false}
    }
    if (body.length > MAX_BODY_LENGTH) {
        // Pre-send validation failure: hard error (emails the owner), not a silent `rejected`.
        return {
            type: "error",
            errorMessage: `Message body exceeds the maximum of ${MAX_BODY_LENGTH} characters.`,
            retryable: false,
        }
    }

    // A non-numeric userId (misfired binding) shouldn't block the send; drop attribution instead.
    let userId: number | undefined
    if (config.userId) {
        const parsed = Number(config.userId)
        if (Number.isFinite(parsed)) {
            userId = parsed
        } else {
            logger.error(`Ignoring invalid Aircall user ID: ${config.userId}`)
        }
    }

    logger.log(`Sending message from line ${lineId}${userId ? ` as user ${userId}` : ""}`)

    const result = await sendNativeMessage(lineId, {to, body, userId})

    if (isErrored(result)) {
        const {statusCode, errorMessage} = result.error

        // 4xx (other than rate limit) means "this message will never succeed" — a routing decision.
        if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
            // 403 is a company/line setup or plan-tier problem the author must fix — hard error.
            if (statusCode === 403) {
                logger.error(`Aircall denied the send (403): ${errorMessage}`)
                return {
                    type: "error",
                    errorMessage: `Aircall denied the send: ${errorMessage}`,
                    retryable: false,
                }
            }
            logger.log(`Aircall rejected the send (${statusCode}): ${errorMessage}`)
            // Echo back the typed phone value we were given (already E.164-normalized by the input).
            return {
                type: "outcome",
                id: "rejected",
                data: {lineId, to: config.to, reason: errorMessage},
            }
        }

        if (statusCode === 429) {
            return {type: "error", errorMessage: "Aircall rate limit (120 RPM)", retryable: true}
        }

        // 5xx is non-retryable on purpose: Aircall exposes no idempotency key on this endpoint, so
        // a retry of a request that actually went through would double-send a billable SMS.
        if (statusCode >= 500) {
            logger.error(`Aircall server error (${statusCode}): ${errorMessage}`)
            return {
                type: "error",
                errorMessage: `Aircall server error: ${errorMessage}`,
                retryable: false,
            }
        }

        // statusCode 0 = network failure / unparseable response — no send happened, safe to retry.
        return {type: "error", errorMessage, retryable: true}
    }

    const message = result.value
    logger.log(`Aircall accepted message ${message.id}`)

    return {
        type: "outcome",
        id: "sent",
        data: {
            messageId: message.id,
            status: message.status ?? undefined,
            sentAt: message.sent_at != null ? new Date(message.sent_at) : undefined,
            to: config.to,
            body,
            lineId,
            userId,
        },
    }
})
