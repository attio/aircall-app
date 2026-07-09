import {isErrored} from "@attio/fetchable"
import {type AircallUser, listUsers} from "../aircall-api/users"
import {createLogger} from "../utils/logger"

const logger = createLogger("get-aircall-users")

export default async function getAircallUsers(): Promise<AircallUser[]> {
    const result = await listUsers()
    if (isErrored(result)) {
        logger.error(`Failed to list Aircall users: ${result.error.errorMessage}`)
        throw new Error(result.error.errorMessage)
    }

    return result.value
}
