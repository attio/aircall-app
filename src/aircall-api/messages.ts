import {type AsyncResult, complete, errored, isErrored} from "@attio/fetchable"
import {type AircallApiError, aircallApi} from "./client"
import {endpoints} from "./endpoints"
import {schemaParseError} from "./error"
import {type AircallNativeMessage, AircallNativeMessageSchema} from "./schemas"

export type {AircallNativeMessage} from "./schemas"

export type SendNativeMessageBody = {
    to: string
    body: string
    /** Optional Aircall user id to attribute the message to in the agents' apps. */
    userId?: number
}

/**
 * Sends via the agent-conversation endpoint so inbound replies keep flowing through the global
 * `message.received` webhook — the same line works bidirectionally with the message-received trigger.
 * Errors are surfaced as-is via `AircallApiError` (with `statusCode`); callers classify them.
 *
 * @see https://developer.aircall.io/api-references/#send-message-in-agent-conversation
 */
export async function sendNativeMessage(
    numberId: number,
    {to, body, userId}: SendNativeMessageBody
): AsyncResult<AircallNativeMessage, AircallApiError> {
    const result = await aircallApi.post(endpoints.nativeSendMessage(numberId), {
        to,
        body,
        ...(userId !== undefined ? {user_id: userId} : {}),
    })

    if (isErrored(result)) return result

    const parsed = AircallNativeMessageSchema.safeParse(result.value)
    if (!parsed.success) return errored(schemaParseError(parsed.error.message))

    return complete(parsed.data)
}
