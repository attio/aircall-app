import {isErrored} from "@attio/fetchable"
import {Workflows} from "attio/server"
import {sendNativeMessage} from "../../../aircall-api/messages"
import {createLogger} from "../../../utils/logger"
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
        const {code, errorMessage} = result.error

        // UNAUTHORIZED/FORBIDDEN mean the connection or line setup itself is broken (bad token,
        // missing plan tier/permission) — a hard error the workspace author must fix, not a
        // per-message routing decision.
        if (code === "UNAUTHORIZED" || code === "FORBIDDEN") {
            logger.error(`Aircall denied the send (${code}): ${errorMessage}`)
            return {
                type: "error",
                errorMessage: `Aircall denied the send: ${errorMessage}`,
                retryable: false,
            }
        }

        // A rejected request (bad recipient, invalid body, ...) means "this message will never
        // succeed" — a routing decision, not a retryable failure.
        if (code === "INVALID_REQUEST" || code === "NOT_FOUND") {
            logger.log(`Aircall rejected the send (${code}): ${errorMessage}`)
            // Echo back the typed phone value we were given (already E.164-normalized by the input).
            return {
                type: "outcome",
                id: "rejected",
                data: {lineId, to: config.to, reason: errorMessage},
            }
        }

        if (code === "RATE_LIMITED") {
            return {type: "error", errorMessage: "Aircall rate limit (120 RPM)", retryable: true}
        }

        // 5xx is non-retryable on purpose: Aircall exposes no idempotency key on this endpoint, so
        // a retry of a request that actually went through would double-send a billable SMS.
        if (code === "AIRCALL_API_ERROR") {
            logger.error(`Aircall server error: ${errorMessage}`)
            return {
                type: "error",
                errorMessage: `Aircall server error: ${errorMessage}`,
                retryable: false,
            }
        }

        // UNEXPECTED_ERROR = network failure / unparseable response — no send happened, safe to retry.
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
