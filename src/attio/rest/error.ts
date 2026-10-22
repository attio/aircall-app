export type AttioApiError =
    | {code: "INVALID_REQUEST"}
    /** A write naming an attribute the activity doesn't have yet. */
    | {code: "UNKNOWN_ATTRIBUTE"}
    | {code: "UNAUTHORIZED"}
    | {code: "FORBIDDEN"}
    | {code: "NOT_FOUND"}
    | {code: "CONFLICT"}
    | {code: "RATE_LIMITED"}
    | {code: "ATTIO_API_ERROR"}
    | {code: "TIMEOUT"}
    /** Attio wasn't reached; worth a retry. */
    | {code: "NETWORK_ERROR"}
    /** An answer we couldn't make sense of; a retry gets the same one. */
    | {code: "UNEXPECTED_ERROR"}

export function mapStatusToAttioError(status: number): AttioApiError {
    switch (status) {
        case 400:
        case 422:
            return {code: "INVALID_REQUEST"}
        case 401:
            return {code: "UNAUTHORIZED"}
        case 403:
            return {code: "FORBIDDEN"}
        case 404:
            return {code: "NOT_FOUND"}
        case 409:
            return {code: "CONFLICT"}
        case 429:
            return {code: "RATE_LIMITED"}
        default:
            return status >= 500 ? {code: "ATTIO_API_ERROR"} : {code: "UNEXPECTED_ERROR"}
    }
}

/** Failures a retry can get past. */
export function isTransientAttioError(error: AttioApiError): boolean {
    switch (error.code) {
        case "RATE_LIMITED":
        case "ATTIO_API_ERROR":
        case "TIMEOUT":
        case "NETWORK_ERROR":
            return true
        case "INVALID_REQUEST":
        case "UNKNOWN_ATTRIBUTE":
        case "UNAUTHORIZED":
        case "FORBIDDEN":
        case "NOT_FOUND":
        case "CONFLICT":
        case "UNEXPECTED_ERROR":
            return false
    }
}
