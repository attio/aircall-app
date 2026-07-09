import {type AsyncResult, complete, errored, isErrored} from "@attio/fetchable"
import {type AircallApiError, aircallApi} from "./client"
import {endpoints} from "./endpoints"
import {schemaParseError} from "./error"
import {type AircallUser, AircallUserListPageSchema} from "./schemas"

export type {AircallUser} from "./schemas"

const PER_PAGE = 50

/**
 * @see https://developer.aircall.io/api-references/#list-all-users-v2
 */
export async function listUsers(): AsyncResult<AircallUser[], AircallApiError> {
    const users: AircallUser[] = []
    let page = 1

    while (true) {
        const result = await aircallApi.get(endpoints.users, {page, per_page: PER_PAGE})

        if (isErrored(result)) return result

        const parsed = AircallUserListPageSchema.safeParse(result.value)
        if (!parsed.success) return errored(schemaParseError(parsed.error.message))

        users.push(...parsed.data.users)

        if (parsed.data.meta.next_page_link === null) break
        page += 1
    }

    return complete(users)
}
