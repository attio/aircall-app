import {isErrored} from "@attio/fetchable"
import {type AircallNumber, listNumbers} from "../aircall-api/numbers"
import {createLogger} from "../utils/logger"

const logger = createLogger("get-aircall-numbers")

export default async function getAircallNumbers(): Promise<AircallNumber[]> {
    const result = await listNumbers()
    if (isErrored(result)) {
        logger.error(`Failed to list Aircall numbers: ${result.error.errorMessage}`)
        throw new Error(result.error.errorMessage)
    }

    return result.value
}
