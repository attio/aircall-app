import {type AsyncResult, complete, isErrored} from "@attio/fetchable"
import {z} from "zod"
import {toDirection} from "../aircall-api/call-direction"
import type {Call} from "../aircall-api/webhook-events"
import {attio, ATTIO_API_URL} from "../attio/rest/attio"
import type {AttioApiError} from "../attio/rest/error"
import type {PersonMatch} from "../find-person-record"
import {createLogger} from "../utils/logger"
import {CALL_ID_ATTRIBUTE_SLUG, CALLS_ACTIVITY_SLUG} from "./activity-definitions"
import {repairActivity} from "./ensure-activities"

const logger = createLogger("aircall activities")

type PersonReference = {target_object: "people"; target_record_id: string}
/** A record by ID, or a plain email: Attio links the workspace member, else a person it creates if needed. */
type Participant = PersonReference | string

type Direction = "Inbound" | "Outbound" | "Unknown"
type Outcome = "Answered" | "Left voicemail" | "Busy" | "No answer"

export type CallActivityInput = {
    call: Call
    /** The people with the counterparty's number; at least one. */
    people: ReadonlyArray<Pick<PersonMatch, "id" | "name">>
    /** Shown in the title when no single person matched. */
    phoneNumber: string
}

/** `undefined` is dropped from the body, so an update keeps what's there. */
export type CallActivityValues = {
    [CALL_ID_ATTRIBUTE_SLUG]: string
    title: string
    timestamp: string
    end_timestamp: string
    direction: Direction
    outcome: Outcome
    linked_records: Array<PersonReference>
    participants: Array<Participant>
    caller: Participant | undefined
    line_name: string | undefined
    line_number: string | undefined
}

function direction(call: Call): Direction {
    switch (toDirection(call.direction)) {
        case "inbound":
            return "Inbound"
        case "outbound":
            return "Outbound"
        case undefined:
            logger.error(`Unknown direction "${call.direction}" on call ${call.id}`)
            return "Unknown"
    }
}

/** Aircall only gives a reason for missed inbound calls. */
function outcome(call: Call): Outcome {
    if (call.answered_at !== undefined) return "Answered"
    if (call.voicemail !== undefined) return "Left voicemail"

    switch (call.missed_call_reason) {
        case "no_available_agent":
            return "Busy"
        case undefined:
        case "agents_did_not_answer":
        case "out_of_opening_hours":
        case "short_abandoned":
        case "abandoned_in_ivr":
        case "abandoned_in_classic":
            return "No answer"
        default:
            logger.error(
                `Unknown missed call reason "${call.missed_call_reason}" on call ${call.id}`
            )
            return "No answer"
    }
}

function contactName(call: Call): string | undefined {
    const name = [call.contact?.first_name, call.contact?.last_name].join(" ").trim()
    return name === "" ? undefined : name
}

/** One match is named; several could be anyone, so the number is shown. */
function counterparty({call, people, phoneNumber}: CallActivityInput): string {
    const matchedName = people.length === 1 ? people[0]?.name : undefined
    return matchedName ?? contactName(call) ?? phoneNumber
}

function title(callDirection: Direction, counterpartyName: string): string {
    switch (callDirection) {
        case "Inbound":
            return `Inbound call from ${counterpartyName}`
        case "Outbound":
            return `Outbound call to ${counterpartyName}`
        case "Unknown":
            return `Call with ${counterpartyName}`
    }
}

/** Attio only takes a number with its country code. */
function lineNumber(call: Call): string | undefined {
    const digits = call.number?.digits
    return digits?.startsWith("+") ? digits : undefined
}

/** Aircall's times are Unix seconds. */
function timestamp(seconds: number): string {
    return new Date(seconds * 1000).toISOString()
}

export function buildCallActivityValues(input: CallActivityInput): CallActivityValues {
    const {call, people} = input
    const linkedPeople = people.map(({id}): PersonReference => ({
        target_object: "people",
        target_record_id: id.record_id,
    }))
    const callDirection = direction(call)
    const agentEmail = call.user?.email
    // Several people on one number: any of them could have called.
    const counterpartyCaller = people.length === 1 ? linkedPeople[0] : undefined

    return {
        [CALL_ID_ATTRIBUTE_SLUG]: String(call.id),
        title: title(callDirection, counterparty(input)),
        timestamp: timestamp(call.started_at),
        end_timestamp: timestamp(call.ended_at),
        direction: callDirection,
        outcome: outcome(call),
        linked_records: linkedPeople,
        participants: agentEmail === undefined ? linkedPeople : [...linkedPeople, agentEmail],
        caller: callDirection === "Outbound" ? agentEmail : counterpartyCaller,
        line_name: call.number?.name,
        line_number: lineNumber(call),
    }
}

async function upsertCallRecord(values: CallActivityValues): AsyncResult<unknown, AttioApiError> {
    return await attio.put({
        url: `${ATTIO_API_URL}/activities/${CALLS_ACTIVITY_SLUG}/records?matching_attribute=${CALL_ID_ATTRIBUTE_SLUG}`,
        body: {data: {values}},
        schema: z.unknown(),
    })
}

function needsRepair(error: AttioApiError): boolean {
    return error.code === "UNKNOWN_ATTRIBUTE" || error.code === "NOT_FOUND"
}

/** Upserts on the Aircall call ID, so resends are safe. Sets up a missing activity or attribute first. */
export async function logCallActivity(input: CallActivityInput): AsyncResult<void, AttioApiError> {
    const {call} = input
    const values = buildCallActivityValues(input)

    let writtenResult = await upsertCallRecord(values)

    if (isErrored(writtenResult) && needsRepair(writtenResult.error)) {
        const repairResult = await repairActivity(CALLS_ACTIVITY_SLUG)
        if (isErrored(repairResult)) return repairResult
        if (repairResult.value) {
            logger.log(
                `Set up the missing parts of ${CALLS_ACTIVITY_SLUG}, writing call ${call.id} again`
            )
            writtenResult = await upsertCallRecord(values)
        }
    }

    return isErrored(writtenResult) ? writtenResult : complete(undefined)
}
