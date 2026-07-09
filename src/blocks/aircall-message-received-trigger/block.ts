import {Workflows} from "attio"

export default Workflows.defineWorkflowBlock({
    type: "trigger",
    id: "aircall-message-received-trigger",
    title: "Message received",
    description:
        "Starts a run when an inbound message (SMS, MMS, or WhatsApp) is received in Aircall.",
    schema: Workflows.ConfigSchema.struct({
        // Optional filter to a single Aircall line, stored as the Aircall number id picked from the
        // configurator. Unset matches every number. Channel is not filtered here — it is exposed on
        // the outcome so the workflow can branch on it.
        numberId: Workflows.ConfigSchema.string().optional(),
    }),
})
