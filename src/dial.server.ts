import type {AsyncResult} from "@attio/fetchable"
import {type DialUnavailableError, dial as dialApi} from "./aircall-api/calls"
import type {AircallApiError} from "./aircall-api/client"

export default async function dial(
    userId: number,
    to: string
): AsyncResult<void, AircallApiError | DialUnavailableError> {
    return dialApi(userId, to)
}
