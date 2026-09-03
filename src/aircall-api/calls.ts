import {type AsyncResult, complete, errored, isErrored} from "@attio/fetchable"
import {z} from "zod"
import {type AircallApiError, aircallApi} from "./client"
import {endpoints} from "./endpoints"
import {schemaParseError} from "./error"
import {AircallDialUnavailableSchema, type AircallInsightContent} from "./schemas"
import {createLogger} from "../utils/logger"

export type {AircallInsightContent} from "./schemas"

const logger = createLogger("aircall calls")

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

const callSummaryResponseSchema = z.object({
    summary: z.object({content: z.string()}),
})

/**
 * Documented error responses are 400 (invalid call_id) and 403 (company not active/verified) —
 * nothing documented for "no AI Assist add-on" or "summary not ready yet", so we don't know how
 * either is signalled. Any failure surfaces as a normal `AircallApiError`; callers should treat it
 * as best-effort and not fatal regardless of cause.
 *
 * @see https://developer.aircall.io/api-references/#retrieve-a-summary
 */
export async function getCallSummary(callId: number): AsyncResult<string, AircallApiError> {
    const result = await aircallApi.get(endpoints.callSummary(callId))
    if (isErrored(result)) {
        logger.error(
            `Failed to fetch summary for call ${callId} (status ${result.error.statusCode}): ${result.error.errorMessage}`
        )
        return result
    }
    if (result.value === undefined) {
        return errored(schemaParseError(`Empty response for call ${callId} summary`))
    }

    const parsed = callSummaryResponseSchema.safeParse(result.value)
    if (!parsed.success) {
        return errored(
            schemaParseError(`Unexpected call ${callId} summary shape: ${parsed.error.message}`)
        )
    }

    return complete(parsed.data.summary.content)
}
