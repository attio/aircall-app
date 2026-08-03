import {Workflows} from "attio"

export default Workflows.defineWorkflowBlock({
    type: "trigger",
    id: "aircall-call-ended-trigger",
    title: "Call ended",
    description: "Starts a run when an Aircall call ends (answered or missed).",
    configSchema: Workflows.ConfigSchema.struct({
        // Optional filter to a single Aircall line, stored as the Aircall number id picked from
        // the configurator. Unset matches every number. Call direction is not filtered here — it
        // is exposed on both outcomes so the workflow can branch on it.
        numberId: Workflows.ConfigSchema.string().optional(),
    }),
})
