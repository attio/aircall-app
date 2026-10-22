import {complete, errored} from "@attio/fetchable"
import {beforeEach, describe, expect, it, vi} from "vitest"
import type {Call} from "../aircall-api/webhook-events"
import {buildCallActivityValues, logCallActivity} from "./call-activity"

const mocks = vi.hoisted(() => ({
    attio: {put: vi.fn()},
    repairActivity: vi.fn(),
    logger: {log: vi.fn(), error: vi.fn()},
}))

vi.mock("../attio/rest/attio", () => ({
    attio: mocks.attio,
    ATTIO_API_URL: "https://api.attio.com/v2",
}))
vi.mock("./ensure-activities", () => ({repairActivity: mocks.repairActivity}))
vi.mock("../utils/logger", () => ({createLogger: () => mocks.logger}))

const call = (overrides: Partial<Call> = {}): Call => ({
    id: 42,
    direction: "inbound",
    started_at: 1_700_000_000,
    answered_at: 1_700_000_010,
    ended_at: 1_700_000_060,
    user: {id: 1, name: "Agent Ada", email: "ada@example.com"},
    number: {id: 2, name: "Sales", digits: "+15550000000"},
    ...overrides,
})

const person = (recordId: string, name?: string) => ({
    id: {workspace_id: "workspace-1", object_id: "people", record_id: recordId},
    name,
})

const grace = person("record-1", "Grace Hopper")
const graceReference = {target_object: "people", target_record_id: "record-1"}

const input = {call: call(), people: [grace], phoneNumber: "+15551234567"}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.attio.put.mockResolvedValue(complete({}))
    mocks.repairActivity.mockResolvedValue(complete(true))
})

describe(buildCallActivityValues, () => {
    it("maps an answered inbound call with the person as the caller", () => {
        expect(buildCallActivityValues(input)).toStrictEqual({
            aircall_call_id: "42",
            title: "Inbound call from Grace Hopper",
            timestamp: "2023-11-14T22:13:20.000Z",
            end_timestamp: "2023-11-14T22:14:20.000Z",
            direction: "Inbound",
            outcome: "Answered",
            linked_records: [graceReference],
            participants: [graceReference, "ada@example.com"],
            caller: graceReference,
            line_name: "Sales",
            line_number: "+15550000000",
        })
    })

    it("makes the agent the caller of an outbound call", () => {
        const values = buildCallActivityValues({...input, call: call({direction: "outbound"})})

        expect(values).toMatchObject({
            title: "Outbound call to Grace Hopper",
            direction: "Outbound",
            caller: "ada@example.com",
        })
    })

    it("tells a voicemail from an unanswered call", () => {
        // Aircall omits the user when nobody answered.
        const unanswered = {
            ...input,
            call: call({direction: "outbound", answered_at: undefined, user: undefined}),
        }

        expect(buildCallActivityValues(unanswered)).toMatchObject({
            outcome: "No answer",
            participants: [graceReference],
            caller: undefined,
        })
        expect(
            buildCallActivityValues({
                ...unanswered,
                call: {...unanswered.call, voicemail: "https://v.example"},
            })
        ).toMatchObject({outcome: "Left voicemail"})
    })

    it("marks a call nobody was free to take as busy", () => {
        const busy = call({
            answered_at: undefined,
            user: undefined,
            missed_call_reason: "no_available_agent",
        })
        const unknown = call({
            answered_at: undefined,
            user: undefined,
            missed_call_reason: "aliens",
        })

        expect(buildCallActivityValues({...input, call: busy})).toMatchObject({outcome: "Busy"})
        expect(buildCallActivityValues({...input, call: unknown})).toMatchObject({
            outcome: "No answer",
        })
        expect(mocks.logger.error).toHaveBeenCalledWith(expect.stringContaining("aliens"))
    })

    it("names no caller and no counterparty when several people share the number", () => {
        const values = buildCallActivityValues({...input, people: [grace, person("record-2")]})

        expect(values).toMatchObject({
            title: "Inbound call from +15551234567",
            linked_records: [
                graceReference,
                {target_object: "people", target_record_id: "record-2"},
            ],
            caller: undefined,
        })
    })

    it("falls back to the Aircall contact's name", () => {
        const values = buildCallActivityValues({
            ...input,
            people: [person("record-1")],
            call: call({contact: {id: 3, first_name: "Grace", last_name: "H"}}),
        })

        expect(values).toMatchObject({title: "Inbound call from Grace H"})
    })
})

describe(logCallActivity, () => {
    it("upserts the record on the Aircall call ID", async () => {
        await expect(logCallActivity(input)).resolves.toEqual(complete(undefined))

        expect(mocks.attio.put).toHaveBeenCalledWith(
            expect.objectContaining({
                url: "https://api.attio.com/v2/activities/aircall_calls/records?matching_attribute=aircall_call_id",
            })
        )
        expect(mocks.attio.put).toHaveBeenCalledWith(
            expect.objectContaining({
                body: {
                    data: {
                        values: expect.objectContaining({
                            participants: [graceReference, "ada@example.com"],
                        }),
                    },
                },
            })
        )
    })

    it("sets up a missing attribute and writes again", async () => {
        mocks.attio.put
            .mockResolvedValueOnce(errored({code: "UNKNOWN_ATTRIBUTE"}))
            .mockResolvedValueOnce(complete({}))

        await expect(logCallActivity(input)).resolves.toEqual(complete(undefined))

        expect(mocks.repairActivity).toHaveBeenCalledWith("aircall_calls")
        expect(mocks.attio.put).toHaveBeenCalledTimes(2)
    })

    it("gives up when there was nothing to set up", async () => {
        mocks.attio.put.mockResolvedValue(errored({code: "NOT_FOUND"}))
        mocks.repairActivity.mockResolvedValue(complete(false))

        await expect(logCallActivity(input)).resolves.toEqual(errored({code: "NOT_FOUND"}))
        expect(mocks.attio.put).toHaveBeenCalledTimes(1)
    })

    it("passes on a failed setup", async () => {
        mocks.attio.put.mockResolvedValue(errored({code: "NOT_FOUND"}))
        mocks.repairActivity.mockResolvedValue(errored({code: "FORBIDDEN"}))

        await expect(logCallActivity(input)).resolves.toEqual(errored({code: "FORBIDDEN"}))
    })
})
