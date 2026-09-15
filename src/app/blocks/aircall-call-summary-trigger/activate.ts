import {Workflows, getWorkspaceConnection} from "attio/server"
import {activateWebhookTrigger} from "../../../aircall-api/webhook-trigger-lifecycle"
import block from "./block"
import {webhookStorageKey} from "./lib/constants"

export default Workflows.defineWorkflowBlockActivate(block, async ({metadata}) => {
    const {uniqueActivationId, triggerCallbackUrl} = metadata

    return activateWebhookTrigger({
        connection: getWorkspaceConnection(),
        uniqueActivationId,
        triggerCallbackUrl,
        customName: `attio-call-summary-${uniqueActivationId}`,
        events: ["summary.created"],
        storageKey: webhookStorageKey(uniqueActivationId),
    })
})
