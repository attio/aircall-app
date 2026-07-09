import {isErrored} from "@attio/fetchable"
import {type Connection, createWebhookHandler, updateWebhookHandler} from "attio/server"
import {createWebhook} from "../aircall-api/webhooks"
import {createLogger} from "../utils/logger"

const events = ["call.created", "call.ended"] as const

const logger = createLogger("connection-added")

export default async function connectionAdded({connection}: {connection: Connection}) {
    logger.log("Connection added, registering Aircall webhook")

    const handler = await createWebhookHandler({fileName: "event"})

    const result = await createWebhook(connection, {
        customName: handler.id,
        url: handler.url,
        events,
    })

    if (isErrored(result)) {
        logger.error(`Failed to register Aircall webhook: ${result.error.errorMessage}`)
        throw new Error(`Failed to register Aircall webhook: ${result.error.errorMessage}`)
    }

    await updateWebhookHandler(handler.id, {
        externalWebhookId: result.value.webhookId,
    })

    logger.log(`Registered Aircall webhook ${result.value.webhookId}`)
}
