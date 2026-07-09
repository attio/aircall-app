import {type AsyncResult, complete, errored} from "@attio/fetchable"
import {type Connection, getWorkspaceConnection} from "attio/server"
import {createLogger} from "../utils/logger"
import {type AircallApiError, formatApiError} from "./error"
import {buildAuthorizationHeader, buildUrl, type QueryParams} from "./url"

export type {AircallApiError} from "./error"

// Aircall rate limit: 120 req/minute per company.
// React to 429s — pre-throttling needs shared state we don't have in a serverless runtime.
const MAX_RETRIES = 3
const RATE_LIMIT_FALLBACK_MS = 60_000

const logger = createLogger("aircall client API")

type RequestOptions = {
    params?: QueryParams
    body?: unknown
    /** Defaults to the workspace connection. Set explicitly for connection-lifecycle events. */
    connection?: Connection
}

async function request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    options: RequestOptions = {}
): AsyncResult<T | undefined, AircallApiError> {
    const connection = options.connection ?? getWorkspaceConnection()
    const url = buildUrl(path, options.params)
    const requestLabel = `${method} ${url}`

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const headers: Record<string, string> = {
                Accept: "application/json",
                Authorization: buildAuthorizationHeader(connection.value),
            }

            const init: RequestInit = {method, headers}

            if (options.body !== undefined) {
                headers["Content-Type"] = "application/json"
                init.body = JSON.stringify(options.body)
            }

            const response = await fetch(url, init)
            logger.log(`${requestLabel} (${response.status})`)

            if (response.status === 429 && attempt < MAX_RETRIES) {
                const retryAfter = response.headers.get("Retry-After")
                const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : RATE_LIMIT_FALLBACK_MS
                await new Promise((resolve) => setTimeout(resolve, delay))
                continue
            }

            if (!response.ok) {
                return errored(await formatApiError(response, requestLabel))
            }

            if (response.status === 204) return complete(undefined)

            const text = await response.text()
            if (!text.trim()) return complete(undefined)

            try {
                return complete(JSON.parse(text) as T)
            } catch {
                logger.error("Invalid JSON response from Aircall")
                return errored({
                    statusCode: response.status,
                    errorMessage: "Invalid response from Aircall",
                })
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "unknown_error"
            logger.error(message)
            return errored({statusCode: 0, errorMessage: message})
        }
    }

    // Unreachable: the loop always returns or continues, and the final iteration's 429 path
    // falls through to `!response.ok` and returns there.
    return errored({statusCode: 429, errorMessage: "Aircall rate limit exhausted"})
}

async function get<T>(
    path: string,
    params?: QueryParams
): AsyncResult<T | undefined, AircallApiError> {
    return request<T>("GET", path, {params})
}

async function post<T>(
    path: string,
    body?: unknown,
    params?: QueryParams
): AsyncResult<T | undefined, AircallApiError> {
    return request<T>("POST", path, {body, params})
}

async function del<T>(
    path: string,
    params?: QueryParams
): AsyncResult<T | undefined, AircallApiError> {
    return request<T>("DELETE", path, {params})
}

export const aircallApi = {get, post, delete: del}

/**
 * Factory for connection-lifecycle events where the workspace connection isn't wired up yet.
 * Threads the explicit `Connection` through every call.
 */
export function aircallApiWithConnection(connection: Connection) {
    async function post<T>(
        path: string,
        body?: unknown,
        params?: QueryParams
    ): AsyncResult<T | undefined, AircallApiError> {
        return request<T>("POST", path, {body, params, connection})
    }

    async function del<T>(
        path: string,
        params?: QueryParams
    ): AsyncResult<T | undefined, AircallApiError> {
        return request<T>("DELETE", path, {params, connection})
    }

    return {post, delete: del}
}
