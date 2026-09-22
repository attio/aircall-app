import {beforeEach, describe, expect, it, vi} from "vitest"
import {createNote} from "../../create-note"
import {findPersonRecord} from "../../find-person-record"
import webhookHandler from "./event.webhook"

vi.mock("../../aircall-api/calls", () => ({
    getCallSummary: vi.fn(async () => ({state: "error", error: {errorMessage: "no summary"}})),
    pushInsightCard: vi.fn(async () => ({state: "complete", value: undefined})),
}))
vi.mock("../../create-note", () => ({createNote: vi.fn()}))
vi.mock("../../find-person-record", () => ({findPersonRecord: vi.fn()}))

const person = (recordId: string) => ({
    id: {workspace_id: "workspace-1", object_id: "people", record_id: recordId},
    name: undefined,
    job_title: undefined,
    location: undefined,
    web_url: `https://app.attio.com/people/${recordId}`,
})

// The kv store in the mock is not cleared between the tests, thus each test needs its own callId.
const callEndedRequest = (callId: number, rawDigits: string) =>
    new Request("https://example.com/webhook", {
        method: "POST",
        body: JSON.stringify({
            event: "call.ended",
            data: {
                id: callId,
                direction: "inbound",
                started_at: 1_700_000_000,
                answered_at: 1_700_000_010,
                ended_at: 1_700_000_060,
                duration: 50,
                raw_digits: rawDigits,
                user: {id: 1, name: "Agent"},
                number: {id: 2, digits: "+15550000000"},
            },
        }),
    })

const notedRecordIds = () => vi.mocked(createNote).mock.calls.map(([recordId]) => recordId)

describe(webhookHandler, () => {
    beforeEach(() => {
        vi.mocked(createNote).mockReset()
        vi.mocked(findPersonRecord).mockReset()
        vi.mocked(findPersonRecord).mockResolvedValue([person("record-1"), person("record-2")])
    })

    it("writes no notes for a hidden caller ID", async () => {
        const response = await webhookHandler(callEndedRequest(1, "anonymous"))

        expect(response.status).toBe(200)
        expect(findPersonRecord).not.toHaveBeenCalled()
        expect(createNote).not.toHaveBeenCalled()
    })

    it("writes one note for each matched person", async () => {
        const response = await webhookHandler(callEndedRequest(2, "+15551234567"))

        expect(response.status).toBe(200)
        expect(notedRecordIds()).toEqual(["record-1", "record-2"])
    })

    it("writes no notes again when Aircall sends the same event again", async () => {
        await webhookHandler(callEndedRequest(3, "+15551234567"))
        vi.mocked(createNote).mockClear()

        const response = await webhookHandler(callEndedRequest(3, "+15551234567"))

        expect(response.status).toBe(200)
        expect(createNote).not.toHaveBeenCalled()
    })

    it("writes only the missing note after a partial failure", async () => {
        vi.mocked(createNote).mockImplementation(async (recordId) => {
            if (recordId === "record-2") throw new Error("429 Too Many Requests")
        })

        const failed = await webhookHandler(callEndedRequest(4, "+15551234567"))
        expect(failed.status).toBe(500)
        expect(notedRecordIds()).toEqual(["record-1", "record-2"])

        vi.mocked(createNote).mockReset()
        const retried = await webhookHandler(callEndedRequest(4, "+15551234567"))

        expect(retried.status).toBe(200)
        expect(notedRecordIds()).toEqual(["record-2"])
    })
})
