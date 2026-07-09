import {type Connection, deleteWebhookHandler, listWebhookHandlers} from "attio/server"
import {disableIntegration} from "../aircall-api/integrations"
import {deleteWebhook} from "../aircall-api/webhooks"
import {createLogger} from "../utils/logger"

const logger = createLogger("connection-removed")

export default async function connectionRemoved({connection}: {connection: Connection}) {
    try {
        const handlers = await listWebhookHandlers()
        logger.log(`Connection removed, tearing down ${handlers.length} webhook handler(s)`)

        // Delete webhooks on Aircall. Errors are swallowed so we still tear down the
        // local Attio handlers and integration record.
        await Promise.all(
            handlers
                .filter(
                    (handler): handler is typeof handler & {externalWebhookId: string} =>
                        handler.externalWebhookId !== null
                )
                .map((handler) => deleteWebhook(connection, handler.externalWebhookId))
        )
        await disableIntegration(connection)

        // Delete webhooks on Attio
        await Promise.all(handlers.map((handler) => deleteWebhookHandler(handler.id)))

        logger.log("Connection teardown complete")
    } catch (error) {
        logger.error("Failed to fully tear down connection", error)
        // don't rethrow the error so the connection is still removed
    }
}
