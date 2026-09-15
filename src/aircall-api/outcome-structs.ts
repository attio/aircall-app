import {Workflows} from "attio/client"

/** Shared across every trigger block whose outcome includes the matched Aircall contact. */
export const aircallContactStruct = Workflows.OutcomeSchema.struct({
    id: Workflows.OutcomeSchema.number().optional(),
    name: Workflows.OutcomeSchema.string().optional(),
    firstName: Workflows.OutcomeSchema.string().optional(),
    lastName: Workflows.OutcomeSchema.string().optional(),
    companyName: Workflows.OutcomeSchema.string().optional(),
})

/** Shared across every call-based trigger block whose outcome includes the handling agent. */
export const agentStruct = Workflows.OutcomeSchema.struct({
    id: Workflows.OutcomeSchema.number().optional(),
    name: Workflows.OutcomeSchema.string().optional(),
    email: Workflows.OutcomeSchema.string().optional(),
})
