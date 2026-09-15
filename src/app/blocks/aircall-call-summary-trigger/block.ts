import {Workflows} from "attio"

export default Workflows.defineWorkflowBlock({
    type: "trigger",
    id: "aircall-call-summary-trigger",
    title: "Call summary ready",
    description:
        "Starts a run when an AI-generated call summary becomes available in Aircall. Requires the Aircall AI Assist add-on.",
    configSchema: Workflows.ConfigSchema.struct({
        numberId: Workflows.ConfigSchema.string().optional(),
    }),
})
