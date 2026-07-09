import {Workflows} from "attio"

export default Workflows.defineWorkflowBlock({
    type: "step",
    id: "aircall-add-to-dialer-campaign",
    title: "Add to dialer campaign",
    description: "Append phone numbers to an Aircall user's dialer campaign.",
    schema: Workflows.ConfigSchema.struct({
        aircallUserId: Workflows.ConfigSchema.string(),
        phoneNumbers: Workflows.ConfigSchema.array(Workflows.ConfigSchema.phoneNumber()),
    }),
})
