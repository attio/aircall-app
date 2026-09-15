import {Workflows, getWorkspaceConnection} from "attio/server"
import {deactivateWebhookTrigger} from "../../../aircall-api/webhook-trigger-lifecycle"
import block from "./block"
import {webhookStorageKey} from "./lib/constants"

export default Workflows.defineWorkflowBlockDeactivate(block, async ({metadata}) => {
    const {uniqueActivationId} = metadata

    return deactivateWebhookTrigger({
        connection: getWorkspaceConnection(),
        uniqueActivationId,
        storageKey: webhookStorageKey(uniqueActivationId),
        triggerLabel: "call-summary trigger",
    })
})
