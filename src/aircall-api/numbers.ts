import {type AsyncResult, complete, errored, isErrored} from "@attio/fetchable"
import {type AircallApiError, aircallApi} from "./client"
import {endpoints} from "./endpoints"
import {schemaParseError} from "./error"
import {type AircallNumber, AircallNumberListPageSchema} from "./schemas"

export type {AircallNumber} from "./schemas"

const PER_PAGE = 50

/**
 * @see https://developer.aircall.io/api-references/#list-all-numbers
 */
export async function listNumbers(): AsyncResult<AircallNumber[], AircallApiError> {
    const numbers: AircallNumber[] = []
    let page = 1

    while (true) {
        const result = await aircallApi.get(endpoints.numbers, {page, per_page: PER_PAGE})

        if (isErrored(result)) return result

        const parsed = AircallNumberListPageSchema.safeParse(result.value)
        if (!parsed.success) return errored(schemaParseError(parsed.error.message))

        numbers.push(...parsed.data.numbers)

        if (parsed.data.meta.next_page_link === null) break
        page += 1
    }

    return complete(numbers)
}
