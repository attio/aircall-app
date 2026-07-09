import {isErrored} from "@attio/fetchable"
import {Workflows, getWorkspaceConnection, kv} from "attio/server"
import {createWebhook, deleteWebhook} from "../../aircall-api/webhooks"
import {createLogger} from "../../utils/logger"
import block from "./block"
import {webhookStorageKey} from "./lib/constants"

const logger = createLogger("aircall-message-received-trigger activate")

export default Workflows.defineWorkflowBlockActivate(block, async ({metadata}) => {
    const {uniqueActivationId, triggerCallbackUrl} = metadata
    const connection = getWorkspaceConnection()

    const result = await createWebhook(connection, {
        customName: `attio-message-received-${uniqueActivationId}`,
        url: triggerCallbackUrl,
        events: ["message.received"],
    })

    if (isErrored(result)) {
        logger.error(`Failed to register webhook: ${result.error.errorMessage}`, {
            uniqueActivationId,
        })
        return {
            type: "error",
            errorMessage: `Could not register Aircall webhook: ${result.error.errorMessage}`,
        }
    }

    const {webhookId} = result.value

    try {
        await kv.set(webhookStorageKey(uniqueActivationId), webhookId)
    } catch (error) {
        // Roll back the webhook so we don't leak an untracked subscription on Aircall.
        logger.error("Failed to persist webhook id, rolling back", {uniqueActivationId, error})
        await deleteWebhook(connection, webhookId)
        return {type: "error", errorMessage: "Could not persist Aircall webhook registration."}
    }

    logger.log(`Registered Aircall webhook ${webhookId}`, {uniqueActivationId})
    return {type: "complete"}
})
