import {type AsyncResult, complete, isErrored} from "@attio/fetchable"
import type {Connection} from "attio/server"
import {type AircallApiError, aircallApiWithConnection} from "./client"
import {endpoints} from "./endpoints"

/**
 * Disable an Aircall integration. Used when the workspace connection is removed.
 */
export async function disableIntegration(
    connection: Connection
): AsyncResult<void, AircallApiError> {
    const result = await aircallApiWithConnection(connection).post(endpoints.disableIntegration)
    return isErrored(result) ? result : complete(undefined)
}
