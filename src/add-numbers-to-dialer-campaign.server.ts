import type {AsyncResult} from "@attio/fetchable"
import type {AircallApiError} from "./aircall-api/client"
import {addPhoneNumbersToCampaign} from "./aircall-api/dialer-campaigns"

export default async function addNumbersToDialerCampaign(
    aircallUserId: number,
    phoneNumbers: string[]
): AsyncResult<void, AircallApiError> {
    return addPhoneNumbersToCampaign(aircallUserId, phoneNumbers)
}
