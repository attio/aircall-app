import {Workflows} from "attio/client"

export const summaryReadyOutcomeSchema = Workflows.OutcomeSchema.struct({
    callId: Workflows.OutcomeSchema.number(),
    summary: Workflows.OutcomeSchema.string().optional(),
})
