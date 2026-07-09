import {createLogger} from "../utils/logger"

export type AircallApiError = {
    statusCode: number
    errorMessage: string
    /**
     * Raw parsed body (object) or text (string) from the error response, when available. Used by
     * callers that need to detect specific error shapes — e.g. dialer-campaigns treats certain
     * 422 bodies as success.
     */
    errorBody?: unknown
}

const logger = createLogger("aircall API error")

export function schemaParseError(message: string): AircallApiError {
    logger.error(`Unexpected Aircall API response: ${message}`)
    return {statusCode: 0, errorMessage: "Unexpected response from Aircall API"}
}

async function readErrorBody(response: Response): Promise<unknown> {
    const text = await response.text().catch(() => null)
    if (!text?.trim()) return null
    try {
        return JSON.parse(text) as unknown
    } catch {
        return text
    }
}

function extractApiMessage(body: unknown): string | null {
    if (typeof body === "string" && body.trim()) return body.trim()

    if (typeof body === "object" && body !== null) {
        for (const key of ["message", "error", "troubleshoot"] as const) {
            if (key in body) {
                const value = (body as Record<string, unknown>)[key]
                if (typeof value === "string" && value.trim()) return value.trim()
            }
        }
    }

    return null
}

function buildErrorMessage(status: number, apiMessage: string | null): string {
    if (status === 401 || status === 403) {
        return apiMessage
            ? `[Aircall API] Authentication failed (${status}): ${apiMessage}`
            : "Aircall authentication failed. Check your workspace connection."
    }
    if (status === 429) {
        return apiMessage
            ? `[Aircall API] Rate limit exceeded: ${apiMessage}`
            : "Aircall rate limit exceeded. Please try again later."
    }
    if (status >= 500) {
        return apiMessage
            ? `[Aircall API] Service unavailable (${status}): ${apiMessage}`
            : "Aircall service temporarily unavailable. Please try again later."
    }
    return apiMessage ? `[Aircall API] ${apiMessage}` : `Aircall API error (${status})`
}

export async function formatApiError(
    response: Response,
    requestLabel: string
): Promise<AircallApiError> {
    const body = await readErrorBody(response)
    const errorMessage = buildErrorMessage(response.status, extractApiMessage(body))

    logger.error(`${requestLabel} failed (${response.status}): ${errorMessage}`)

    return {statusCode: response.status, errorMessage, errorBody: body}
}
