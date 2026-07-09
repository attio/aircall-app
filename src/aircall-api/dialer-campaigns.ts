import {type AsyncResult, complete, isErrored} from "@attio/fetchable"
import {type AircallApiError, aircallApi} from "./client"
import {endpoints} from "./endpoints"
import {AircallDialerCampaign422Schema} from "./schemas"

/**
 * Append phone numbers to an Aircall user's active Dialer Campaign. The endpoint behaves as an
 * upsert: creates a new campaign if none is active, otherwise appends to the existing one.
 *
 * A 422 with only "already imported, but not called" entries is treated as success — those numbers
 * are already queued from a prior call, the rest were appended fine.
 *
 * @see https://developer.aircall.io/api-references/#create-a-dialer-campaign
 */
export async function addPhoneNumbersToCampaign(
    userId: number,
    phoneNumbers: string[]
): AsyncResult<void, AircallApiError> {
    const result = await aircallApi.post(endpoints.dialerCampaign(userId), {
        phone_numbers: phoneNumbers,
    })

    if (isErrored(result)) {
        const parsed = AircallDialerCampaign422Schema.safeParse(result.error.errorBody)
        const allAlreadyImported =
            parsed.success &&
            parsed.data.errors.dialer_campaign.every((e) =>
                e.includes("already imported, but not called")
            )

        return allAlreadyImported ? complete(undefined) : result
    }

    return complete(undefined)
}
