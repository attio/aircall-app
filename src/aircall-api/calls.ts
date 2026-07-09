import {type AsyncResult, complete, errored, isErrored} from "@attio/fetchable"
import {type AircallApiError, aircallApi} from "./client"
import {endpoints} from "./endpoints"
import {AircallDialUnavailableSchema, type AircallInsightContent} from "./schemas"

export type {AircallInsightContent} from "./schemas"

export type DialUnavailableError = {
    kind: "user-unavailable"
    errorMessage: string
}

/**
 * Returns a specific error kind for the common "user unavailable" case (app not open) so callers
 * can offer a retry.
 *
 * @see https://developer.aircall.io/api-references/#dial-a-phone-number
 */
export async function dial(
    userId: number,
    to: string
): AsyncResult<void, AircallApiError | DialUnavailableError> {
    const result = await aircallApi.post(endpoints.dial(userId), {to})

    if (isErrored(result)) {
        const unavailable = AircallDialUnavailableSchema.safeParse(result.error.errorBody)
        if (unavailable.success) {
            return errored({kind: "user-unavailable", errorMessage: unavailable.data.troubleshoot})
        }
        return result
    }

    return complete(undefined)
}

/**
 * @see https://developer.aircall.io/api-references/#push-an-insight-card
 */
export async function pushInsightCard(
    callId: number,
    contents: AircallInsightContent[]
): AsyncResult<void, AircallApiError> {
    const result = await aircallApi.post(endpoints.insightCards(callId), {contents})
    return isErrored(result) ? result : complete(undefined)
}
