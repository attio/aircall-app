import {Workflows} from "attio"

export default Workflows.defineWorkflowBlock({
    type: "trigger",
    id: "aircall-recording-ready-trigger",
    title: "Recording or voicemail ready",
    description:
        "Starts a run when a call recording or voicemail link becomes available in Aircall, including assets that weren't ready yet when the call ended.",
    configSchema: Workflows.ConfigSchema.struct({
        numberId: Workflows.ConfigSchema.string().optional(),
    }),
})
