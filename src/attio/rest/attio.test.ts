import {isComplete, isErrored} from "@attio/fetchable"
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest"
import {z} from "zod"
import {attio} from "./attio"

const mocks = vi.hoisted(() => ({logger: {log: vi.fn(), error: vi.fn()}}))

vi.mock("../../utils/logger", () => ({createLogger: () => mocks.logger}))

const URL_UNDER_TEST = "https://api.attio.com/v2/activities"

function rateLimited(retryAfter?: string): Response {
    return new Response(null, {
        status: 429,
        headers: retryAfter === undefined ? {} : {"Retry-After": retryAfter},
    })
}

function stubFetch(...responses: Array<Response>) {
    const fetchMock = vi.fn(async () => responses.shift() ?? new Response(null, {status: 500}))
    vi.stubGlobal("fetch", fetchMock)
    return fetchMock
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe(attio.get, () => {
    it("retries a rate-limited call, waiting until the reset Attio gives", async () => {
        vi.setSystemTime(new Date("2026-10-16T12:00:00Z"))
        const fetchMock = stubFetch(
            rateLimited("Fri, 16 Oct 2026 12:00:02 GMT"),
            new Response(JSON.stringify({data: []}))
        )

        const pending = attio.get({
            url: URL_UNDER_TEST,
            schema: z.object({data: z.array(z.unknown())}),
        })
        await vi.advanceTimersByTimeAsync(1_999)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        await vi.advanceTimersByTimeAsync(1)

        expect(isComplete(await pending)).toBe(true)
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("stops retrying when the next attempt wouldn't fit in the budget", async () => {
        // Each answer takes 4s, so the second retry would start with half a second left.
        const fetchMock = vi.fn(
            (_url: string, init: RequestInit) =>
                new Promise<Response>((resolve, reject) => {
                    const answer = setTimeout(() => resolve(rateLimited()), 4_000)
                    init.signal?.addEventListener("abort", () => {
                        clearTimeout(answer)
                        reject(new Error("aborted"))
                    })
                })
        )
        vi.stubGlobal("fetch", fetchMock)

        const pending = attio.get({url: URL_UNDER_TEST, schema: z.unknown()})
        await vi.runAllTimersAsync()
        const result = await pending

        expect(isErrored(result) && result.error.code).toBe("RATE_LIMITED")
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it("gives up as rate limited after two retries", async () => {
        const fetchMock = stubFetch(rateLimited(), rateLimited(), rateLimited())

        const pending = attio.get({url: URL_UNDER_TEST, schema: z.unknown()})
        await vi.runAllTimersAsync()
        const result = await pending

        expect(isErrored(result) && result.error.code).toBe("RATE_LIMITED")
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it("gives up on a call Attio doesn't answer in time", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(
                (_url: string, init: RequestInit) =>
                    new Promise((_resolve, reject) => {
                        init.signal?.addEventListener("abort", () => reject(new Error("aborted")))
                    })
            )
        )

        const pending = attio.get({url: URL_UNDER_TEST, schema: z.unknown()})
        await vi.advanceTimersByTimeAsync(10_000)
        const result = await pending

        expect(isErrored(result) && result.error.code).toBe("TIMEOUT")
    })

    it("tells a failed connection apart from an answer it can't read", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => {
                throw new TypeError("fetch failed")
            })
        )
        const unreachable = await attio.get({url: URL_UNDER_TEST, schema: z.unknown()})

        stubFetch(new Response("not json"))
        const unreadable = await attio.get({url: URL_UNDER_TEST, schema: z.unknown()})

        expect(isErrored(unreachable) && unreachable.error.code).toBe("NETWORK_ERROR")
        expect(isErrored(unreadable) && unreadable.error.code).toBe("UNEXPECTED_ERROR")
    })

    it("tells a missing attribute apart from other rejected writes", async () => {
        stubFetch(
            new Response(
                JSON.stringify({
                    code: "value_not_found",
                    message: 'Cannot find attribute with slug/ID "line_name".',
                }),
                {status: 400}
            ),
            new Response(
                JSON.stringify({
                    code: "value_not_found",
                    message:
                        'No attribute was found for matching_attribute slug/ID "aircall_call_id".',
                }),
                {status: 400}
            ),
            new Response(
                JSON.stringify({
                    code: "value_not_found",
                    message: 'Cannot find select option with title "inbound".',
                }),
                {status: 400}
            )
        )

        const missing = await attio.get({url: URL_UNDER_TEST, schema: z.unknown()})
        const missingMatching = await attio.get({url: URL_UNDER_TEST, schema: z.unknown()})
        const rejected = await attio.get({url: URL_UNDER_TEST, schema: z.unknown()})

        expect(isErrored(missing) && missing.error.code).toBe("UNKNOWN_ATTRIBUTE")
        expect(isErrored(missingMatching) && missingMatching.error.code).toBe("UNKNOWN_ATTRIBUTE")
        expect(isErrored(rejected) && rejected.error.code).toBe("INVALID_REQUEST")
    })

    it("logs a rejected write without the phone number Attio quotes", async () => {
        stubFetch(
            new Response(
                JSON.stringify({
                    code: "value_not_found",
                    message: 'Cannot find target record with value "+15551234567".',
                }),
                {status: 400}
            )
        )

        await attio.post({url: URL_UNDER_TEST, body: {}, schema: z.unknown()})

        expect(mocks.logger.error).toHaveBeenCalledWith(
            'POST /v2/activities failed with 400 (INVALID_REQUEST); value_not_found: Cannot find target record with value "[REDACTED]".'
        )
    })

    it("answers a missing activity without logging it as a failure", async () => {
        stubFetch(new Response(null, {status: 404}))

        const result = await attio.get({url: URL_UNDER_TEST, schema: z.unknown()})

        expect(isErrored(result) && result.error.code).toBe("NOT_FOUND")
        expect(mocks.logger.error).not.toHaveBeenCalled()
    })
})
