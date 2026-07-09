import {isErrored} from "@attio/fetchable"
import {Workflows, getWorkspaceConnection, kv} from "attio/server"
import {deleteWebhook} from "../../aircall-api/webhooks"
import {createLogger} from "../../utils/logger"
import block from "./block"
import {webhookStorageKey} from "./lib/constants"

const logger = createLogger("aircall-call-ended-trigger deactivate")

export default Workflows.defineWorkflowBlockDeactivate(block, async ({metadata}) => {
    const {uniqueActivationId} = metadata
    const key = webhookStorageKey(uniqueActivationId)

    const stored = await kv.get(key)
    const webhookId = typeof stored?.value === "string" ? stored.value : null

    if (webhookId) {
        const result = await deleteWebhook(getWorkspaceConnection(), webhookId)

        // 404 means the webhook is already gone — treat as success and clean up KV. Any other
        // failure: keep the KV entry so a later deactivate retry can finish the teardown.
        if (isErrored(result) && result.error.statusCode !== 404) {
            logger.error(`Failed to delete webhook ${webhookId}: ${result.error.errorMessage}`, {
                uniqueActivationId,
            })
            return {type: "error", errorMessage: result.error.errorMessage}
        }
    }

    await kv.delete(key)
    logger.log("Deactivated call-ended trigger", {uniqueActivationId, webhookId})
    return {type: "complete"}
})
