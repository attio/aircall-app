import {type AsyncResult, complete, errored, isErrored} from "@attio/fetchable"
import type {Connection} from "attio/server"
import {type AircallApiError, aircallApiWithConnection} from "./client"
import {endpoints} from "./endpoints"
import {schemaParseError} from "./error"
import {AircallCreateWebhookResponseSchema} from "./schemas"

export type CreateWebhookParams = {
    customName: string
    url: string
    events: readonly string[]
}

/**
 * Register an Aircall webhook for the given connection.
 *
 * @see https://developer.aircall.io/api-references/#create-a-webhook
 */
export async function createWebhook(
    connection: Connection,
    params: CreateWebhookParams
): AsyncResult<{webhookId: string}, AircallApiError> {
    const result = await aircallApiWithConnection(connection).post(endpoints.webhooks, {
        custom_name: params.customName,
        url: params.url,
        events: params.events,
    })

    if (isErrored(result)) return result

    const parsed = AircallCreateWebhookResponseSchema.safeParse(result.value)
    if (!parsed.success) return errored(schemaParseError(parsed.error.message))

    return complete({webhookId: parsed.data.webhook.webhook_id})
}

/**
 * Delete an Aircall webhook.
 *
 * @see https://developer.aircall.io/api-references/#delete-a-webhook
 */
export async function deleteWebhook(
    connection: Connection,
    webhookId: string
): AsyncResult<void, AircallApiError> {
    const result = await aircallApiWithConnection(connection).delete(endpoints.webhook(webhookId))
    return isErrored(result) ? result : complete(undefined)
}
