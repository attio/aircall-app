import {afterEach, beforeEach, describe, expect, it, vi} from "vitest"
import {aircallApi} from "./client"

const fetchMock = vi.fn()

beforeEach(() => {
    vi.useFakeTimers({now: new Date("2026-10-21T07:00:00Z")})
    vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    fetchMock.mockReset()
})

describe("aircallApi rate limiting", () => {
    it("waits the fallback window when Retry-After is not a number of seconds", async () => {
        fetchMock
            .mockResolvedValueOnce(
                new Response(null, {
                    status: 429,
                    headers: {"Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT"},
                })
            )
            .mockResolvedValueOnce(new Response(null, {status: 204}))

        const resultPromise = aircallApi.get("/v1/users")

        await vi.advanceTimersByTimeAsync(59_999)
        expect(fetchMock).toHaveBeenCalledTimes(1)
        await vi.advanceTimersByTimeAsync(1)
        await resultPromise
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })
})
