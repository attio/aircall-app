import {Workflows} from "attio/client"

/** Aircall accepted the message (carrier delivery still in flight). */
export const sentOutcomeSchema = Workflows.OutcomeSchema.struct({
    messageId: Workflows.OutcomeSchema.string(),
    // Raw Aircall status (empirically "pending"); not a promised enum.
    status: Workflows.OutcomeSchema.string().optional(),
    // Aircall ms timestamp → Date; absent while queued.
    sentAt: Workflows.OutcomeSchema.timestamp().optional(),
    to: Workflows.OutcomeSchema.phoneNumber(),
    body: Workflows.OutcomeSchema.string(),
    lineId: Workflows.OutcomeSchema.number(),
    userId: Workflows.OutcomeSchema.number().optional(),
})

/**
 * Aircall returned a 4xx meaning the message will never succeed (line not SMS-capable, conversation
 * not allowed, …). A routing decision, not a system fault — distinct from `{type: "error"}` so
 * workflows can branch (e.g. fall back to email).
 */
export const rejectedOutcomeSchema = Workflows.OutcomeSchema.struct({
    lineId: Workflows.OutcomeSchema.number(),
    to: Workflows.OutcomeSchema.phoneNumber(),
    // Aircall's troubleshoot text, verbatim.
    reason: Workflows.OutcomeSchema.string(),
})
