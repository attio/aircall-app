import {createLogger} from "../utils/logger"

type AircallApiErrorCode =
    | "NOT_FOUND"
    | "RATE_LIMITED"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "INVALID_REQUEST"
    | "AIRCALL_API_ERROR" // 5xx from upstream
    | "UNEXPECTED_ERROR"

export type AircallApiError = {
    code: AircallApiErrorCode
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
    return {code: "UNEXPECTED_ERROR", errorMessage: "Unexpected response from Aircall API"}
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

function mapStatusToCode(status: number): AircallApiErrorCode {
    switch (status) {
        case 401:
            return "UNAUTHORIZED"
        case 403:
            return "FORBIDDEN"
        case 404:
            return "NOT_FOUND"
        case 429:
            return "RATE_LIMITED"
        default:
            if (status >= 500) return "AIRCALL_API_ERROR"
            if (status >= 400) return "INVALID_REQUEST"
            return "UNEXPECTED_ERROR"
    }
}

function buildErrorMessage(code: AircallApiErrorCode, apiMessage: string | null): string {
    switch (code) {
        case "UNAUTHORIZED":
            return apiMessage
                ? `[Aircall API] Authentication failed: ${apiMessage}`
                : "Aircall authentication failed. Check your workspace connection."
        case "FORBIDDEN":
            return apiMessage
                ? `[Aircall API] Forbidden: ${apiMessage}`
                : "Aircall denied the request. Check that your API credentials have the required permissions."
        case "RATE_LIMITED":
            return apiMessage
                ? `[Aircall API] Rate limit exceeded: ${apiMessage}`
                : "Aircall rate limit exceeded. Please try again later."
        case "AIRCALL_API_ERROR":
            return apiMessage
                ? `[Aircall API] Service unavailable: ${apiMessage}`
                : "Aircall service temporarily unavailable. Please try again later."
        default:
            return apiMessage ? `[Aircall API] ${apiMessage}` : "Aircall API error"
    }
}

export async function formatApiError(
    response: Response,
    requestLabel: string
): Promise<AircallApiError> {
    const body = await readErrorBody(response)
    const code = mapStatusToCode(response.status)
    const errorMessage = buildErrorMessage(code, extractApiMessage(body))

    logger.error(`${requestLabel} failed (${response.status}): ${errorMessage}`)

    return {code, errorMessage, errorBody: body}
}
