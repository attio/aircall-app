import {isErrored} from "@attio/fetchable"
import {type Connection, kv} from "attio/server"
import {createLogger} from "../utils/logger"
import {createWebhook, deleteWebhook} from "./webhooks"

const logger = createLogger("aircall webhook trigger lifecycle")

type LifecycleResult = {type: "complete"} | {type: "error"; errorMessage: string}

export type ActivateWebhookTriggerParams = {
    connection: Connection
    uniqueActivationId: string
    triggerCallbackUrl: string
    customName: string
    events: readonly string[]
    storageKey: string
}

/**
 * Registers an Aircall webhook for a trigger block's activation and persists its id in KV so
 * `deactivateWebhookTrigger` can tear it down later. Shared by every Aircall trigger block —
 * `activate.ts` only needs to supply the block-specific webhook name/events/storage key.
 */
export async function activateWebhookTrigger(
    params: ActivateWebhookTriggerParams
): Promise<LifecycleResult> {
    const {connection, uniqueActivationId, triggerCallbackUrl, customName, events, storageKey} =
        params

    const result = await createWebhook(connection, {customName, url: triggerCallbackUrl, events})

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
        await kv.set(storageKey, webhookId)
    } catch (error) {
        // Roll back the webhook so we don't leak an untracked subscription on Aircall.
        logger.error("Failed to persist webhook id, rolling back", {uniqueActivationId, error})
        await deleteWebhook(connection, webhookId)
        return {type: "error", errorMessage: "Could not persist Aircall webhook registration."}
    }

    logger.log(`Registered Aircall webhook ${webhookId}`, {uniqueActivationId})
    return {type: "complete"}
}

export type DeactivateWebhookTriggerParams = {
    connection: Connection
    uniqueActivationId: string
    storageKey: string
    triggerLabel: string
}

/** Deletes the webhook registered by `activateWebhookTrigger` and clears its KV entry. */
export async function deactivateWebhookTrigger(
    params: DeactivateWebhookTriggerParams
): Promise<LifecycleResult> {
    const {connection, uniqueActivationId, storageKey, triggerLabel} = params

    const stored = await kv.get(storageKey)
    const webhookId = typeof stored?.value === "string" ? stored.value : null

    if (webhookId) {
        const result = await deleteWebhook(connection, webhookId)

        // NOT_FOUND means the webhook is already gone — treat as success and clean up KV. Any other
        // failure: keep the KV entry so a later deactivate retry can finish the teardown.
        if (isErrored(result) && result.error.code !== "NOT_FOUND") {
            logger.error(`Failed to delete webhook ${webhookId}: ${result.error.errorMessage}`, {
                uniqueActivationId,
            })
            return {type: "error", errorMessage: result.error.errorMessage}
        }
    }

    await kv.delete(storageKey)
    logger.log(`Deactivated ${triggerLabel}`, {uniqueActivationId, webhookId})
    return {type: "complete"}
}
