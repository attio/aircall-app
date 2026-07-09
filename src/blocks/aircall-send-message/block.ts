import {Workflows} from "attio"

export default Workflows.defineWorkflowBlock({
    type: "step",
    id: "aircall-send-message",
    title: "Send message",
    description:
        "Send an SMS from an Aircall number. Best for conversational, per-record sends — high-volume blasts can disrupt agents.",
    schema: Workflows.ConfigSchema.struct({
        lineId: Workflows.ConfigSchema.string(),
        to: Workflows.ConfigSchema.phoneNumber(),
        body: Workflows.ConfigSchema.string(),
        userId: Workflows.ConfigSchema.string().optional(),
    }),
})
