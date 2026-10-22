import {type AsyncResult, complete, errored, fromPromise, isErrored} from "@attio/fetchable"
import {ATTIO_API_TOKEN} from "attio/server"
import {z} from "zod"
import {createLogger} from "../../utils/logger"
import {redactPersonalData} from "../../utils/redact-personal-data"
import {type AttioApiError, mapStatusToAttioError} from "./error"

export const ATTIO_API_URL = "https://api.attio.com/v2"

const logger = createLogger("attio")
const MAX_RATE_LIMIT_RETRIES = 2
const MAX_RETRY_DELAY_MS = 3_000
/** Per request, retries included. Leaves room in the 30s server limit for the calls around it. */
const REQUEST_BUDGET_MS = 10_000
/** A retry with less time than this left isn't worth the request. */
const MIN_ATTEMPT_MS = 1_000

type Method = "GET" | "POST" | "PUT"
type RequestOptions<TSchema extends z.ZodTypeAny> = {url: string; schema: TSchema}
type BodyOptions<TSchema extends z.ZodTypeAny> = RequestOptions<TSchema> & {body: unknown}

const ErrorDetailSchema = z.object({code: z.string().optional(), message: z.string().optional()})

type ErrorDetail = z.infer<typeof ErrorDetailSchema>

async function readErrorDetail(response: Response): Promise<ErrorDetail> {
    const bodyResult = await fromPromise(response.json())
    if (isErrored(bodyResult)) return {}

    const parsed = ErrorDetailSchema.safeParse(bodyResult.value)
    return parsed.success ? parsed.data : {}
}

/** A missing matching attribute is checked before the values, so it has its own message. */
const UNKNOWN_ATTRIBUTE_MESSAGES = [
    "Cannot find attribute",
    "No attribute was found for matching_attribute",
]

/** `value_not_found` covers other values too; the message says which. */
function isUnknownAttribute({code, message}: ErrorDetail): boolean {
    return (
        code === "value_not_found" &&
        UNKNOWN_ATTRIBUTE_MESSAGES.some((start) => message?.startsWith(start) === true)
    )
}

function retryDelayMs(response: Response, attempt: number): number {
    const resetsAt = Date.parse(response.headers.get("Retry-After") ?? "")
    const delay = Number.isFinite(resetsAt) ? resetsAt - Date.now() : 500 * 2 ** attempt
    return Math.min(Math.max(delay, 0), MAX_RETRY_DELAY_MS)
}

async function send({
    method,
    url,
    body,
    label,
    timeoutMs,
}: {
    method: Method
    url: string
    body: unknown
    label: string
    timeoutMs: number
}): AsyncResult<Response, AttioApiError> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    const sentResult = await fromPromise(
        fetch(url, {
            method,
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${ATTIO_API_TOKEN}`,
                ...(body === undefined ? {} : {"Content-Type": "application/json"}),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller.signal,
        })
    )
    clearTimeout(timeout)
    if (!isErrored(sentResult)) return sentResult

    if (controller.signal.aborted) {
        logger.error(`${label} timed out`)
        return errored({code: "TIMEOUT"})
    }
    logger.error(`${label} could not reach Attio`, sentResult.error)
    return errored({code: "NETWORK_ERROR"})
}

async function request<TSchema extends z.ZodTypeAny>(
    method: Method,
    {url, schema, body}: RequestOptions<TSchema> & {body?: unknown}
): AsyncResult<z.infer<TSchema>, AttioApiError> {
    const label = `${method} ${new URL(url).pathname}`
    const deadline = Date.now() + REQUEST_BUDGET_MS

    let sentResult = await send({method, url, body, label, timeoutMs: REQUEST_BUDGET_MS})
    for (let attempt = 0; attempt < MAX_RATE_LIMIT_RETRIES; attempt++) {
        if (isErrored(sentResult) || sentResult.value.status !== 429) break
        const delay = retryDelayMs(sentResult.value, attempt)
        const timeoutMs = deadline - Date.now() - delay
        if (timeoutMs < MIN_ATTEMPT_MS) break
        await new Promise((resolve) => setTimeout(resolve, delay))
        sentResult = await send({method, url, body, label, timeoutMs})
    }
    if (isErrored(sentResult)) return sentResult
    const response = sentResult.value

    if (!response.ok) {
        const statusError = mapStatusToAttioError(response.status)
        // A missing activity is expected, not worth logging.
        if (statusError.code === "NOT_FOUND") return errored(statusError)

        const detail = await readErrorDetail(response)
        const error: AttioApiError =
            statusError.code === "INVALID_REQUEST" && isUnknownAttribute(detail)
                ? {code: "UNKNOWN_ATTRIBUTE"}
                : statusError
        const parts = [detail.code, detail.message].filter((part) => part !== undefined)
        const suffix = parts.length === 0 ? "" : `; ${redactPersonalData(parts.join(": "))}`
        logger.error(`${label} failed with ${response.status} (${error.code})${suffix}`)
        return errored(error)
    }

    const bodyResult = await fromPromise(response.json())
    if (isErrored(bodyResult)) {
        logger.error(`${label} returned a body that is not valid JSON`)
        return errored({code: "UNEXPECTED_ERROR"})
    }

    const parsed = schema.safeParse(bodyResult.value)
    if (!parsed.success) {
        const paths = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")
        logger.error(`${label} returned an unexpected shape at: ${paths}`)
        return errored({code: "UNEXPECTED_ERROR"})
    }

    return complete(parsed.data)
}

export const attio = {
    get: <TSchema extends z.ZodTypeAny>(options: RequestOptions<TSchema>) =>
        request("GET", options),
    post: <TSchema extends z.ZodTypeAny>(options: BodyOptions<TSchema>) => request("POST", options),
    put: <TSchema extends z.ZodTypeAny>(options: BodyOptions<TSchema>) => request("PUT", options),
}
