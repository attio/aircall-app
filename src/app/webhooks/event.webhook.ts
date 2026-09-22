import {isErrored} from "@attio/fetchable"
import {formatDuration} from "date-fns"
import {type AircallInsightContent, getCallSummary, pushInsightCard} from "../../aircall-api/calls"
import {normalizeCounterpartyPhone} from "../../aircall-api/phone"
import {type Call, payloadSchema} from "../../aircall-api/webhook-events"
import {
    acquireCallNoteLock,
    completeCallNoteLock,
    recordPartialCallNotes,
    releaseCallNoteLock,
} from "../../call-note-lock"
import {createNote} from "../../create-note"
import {findPersonRecord, type PersonMatch} from "../../find-person-record"
import {createLogger} from "../../utils/logger"

const logger = createLogger("aircall webhook")

function abbreviatedDuration(durationInSeconds: number): string {
    const hours = Math.floor(durationInSeconds / 3600)
    const minutes = Math.floor((durationInSeconds % 3600) / 60)

    if (hours > 0) {
        if (minutes > 0) {
            return `${hours}h${minutes}m`
        }
        return `${hours}h`
    }
    if (minutes > 0) {
        return `${minutes}m`
    }
    return `${durationInSeconds}s`
}

async function buildNote(
    call: Call,
    phoneNumber: string,
    startedAt: Date
): Promise<{title: string; content: string}> {
    // Aircall omits the user when nobody answered the call.
    const agentName = call.user?.name ?? "Unknown"
    const numberDigits = call.number?.digits ?? "unknown number"
    const callDuration = call.duration ?? 0
    const title = call.answered_at
        ? `Call with ${agentName} (${abbreviatedDuration(callDuration)})`
        : `Missed call from ${agentName}`
    let content = `Call from ${agentName} (${numberDigits}) to ${phoneNumber}.

${
    call.answered_at
        ? `Call lasted ${formatDuration({seconds: callDuration})}.
Started at: ${startedAt.toLocaleString()}
`
        : `Call was not answered after ${formatDuration({seconds: callDuration})}.
Started at: ${startedAt.toLocaleString()}
`
}`
    if (call.comments && call.comments.length > 0) {
        content += `\n\nNotes: \n${call.comments.map((c) => c.content).join("\n")}`
    }
    if (call.asset) {
        content += `\n\nRecording: [${call.asset}](${call.asset})`
    }

    // We assume that Aircall makes the AI summary before the call.ended event. A 404 error is
    // usual: a call of less than 60 seconds and an account without the AI Assist add-on get no
    // summary. If users report that the summary is missing, append it from the `summary.created`
    // webhook event instead.
    const summaryResult = await getCallSummary(call.id)
    if (isErrored(summaryResult)) {
        logger.error(`No AI summary for call ${call.id}: ${summaryResult.error.errorMessage}`)
    } else {
        content += `\n\nAI Summary: ${summaryResult.value}`
    }

    return {title, content}
}

async function handleCallEnded(call: Call, phoneNumber: string): Promise<Response> {
    const lock = await acquireCallNoteLock(call.id)

    switch (lock.status) {
        case "already-processed":
            logger.log(`Call ${call.id} already processed, skipping`)
            return new Response(null, {status: 200})
        case "busy":
            // Answer 500 so that Aircall sends the event again if the other handler stops
            // before it writes the notes.
            logger.log(`Call ${call.id} is already being processed, skipping`)
            return new Response(null, {status: 500})
        case "acquired":
            break
    }

    let people: PersonMatch[] | null
    try {
        people = await findPersonRecord(phoneNumber)
    } catch (error) {
        logger.error(`Failed to look up person records for call ${call.id}`, error)
        await releaseCallNoteLock(call.id, [...lock.alreadyNoted])
        return new Response(null, {status: 500})
    }

    if (!people) {
        logger.log(`No matching person record for call ${call.id}, skipping`)
        await releaseCallNoteLock(call.id, [...lock.alreadyNoted])
        return new Response(null, {status: 200})
    }
    logger.log(`Matched ${people.length} person record(s) for call ${call.id}`)

    const startedAt = new Date(call.started_at * 1000)
    const {title, content} = await buildNote(call, phoneNumber, startedAt)

    const targets = people.filter((person) => !lock.alreadyNoted.has(person.id.record_id))
    if (targets.length === 0) {
        logger.log(`All notes for call ${call.id} already exist, skipping`)
        await completeCallNoteLock(call.id, [...lock.alreadyNoted])
        return new Response(null, {status: 200})
    }

    // One failed write must not discard the writes that were successful.
    const results = await Promise.allSettled(
        targets.map((person) =>
            createNote(person.id.record_id, title, content, startedAt.toISOString())
        )
    )
    const noted = [
        ...lock.alreadyNoted,
        ...targets
            .filter((_, index) => results[index]?.status === "fulfilled")
            .map((person) => person.id.record_id),
    ]
    const failures = results.filter((result) => result.status === "rejected")

    if (failures.length === 0) {
        logger.log(`Created ${targets.length} note(s) for call ${call.id}`)
        await completeCallNoteLock(call.id, noted)
        return new Response(null, {status: 200})
    }

    logger.error(
        `Failed to create ${failures.length} of ${targets.length} note(s) for call ${call.id}`,
        ...failures.map((failure) => failure.reason)
    )
    await recordPartialCallNotes(call.id, noted)
    return new Response(null, {status: 500})
}

export default async function webhookHandler(req: Request): Promise<Response> {
    const body = await req.json()

    const payloadResult = payloadSchema.safeParse(body)

    if (!payloadResult.success) {
        logger.error("Unexpected payload", payloadResult.error)

        // Answer 200: Aircall must not send an unusable payload again.
        return new Response(null, {status: 200})
    }

    const payload = payloadResult.data
    logger.log(`Received ${payload.event} for call ${payload.data.id}`)

    // raw_digits is the number of the other party.
    const phoneNumber = normalizeCounterpartyPhone(payload.data.raw_digits)
    if (!phoneNumber) {
        logger.log(`Call ${payload.data.id} has no usable counterparty number, skipping`)
        return new Response(null, {status: 200})
    }

    const {event} = payload
    switch (event) {
        case "call.created": {
            const people = await findPersonRecord(phoneNumber)
            if (!people) {
                logger.log(`No matching person record for call ${payload.data.id}, skipping`)
                return new Response(null, {status: 200})
            }

            const [person] = people
            const contents: AircallInsightContent[] = []
            if (person.name) {
                contents.push({
                    type: "title",
                    text: person.name,
                    link: person.web_url,
                })
            }
            if (person.job_title) {
                contents.push({
                    type: "shortText",
                    label: "Job Title",
                    text: person.job_title,
                })
            }
            if (person.location) {
                contents.push({
                    type: "shortText",
                    label: "Location",
                    text: person.location,
                })
            }
            if (contents.length > 0) {
                const pushResult = await pushInsightCard(payload.data.id, contents)
                if (isErrored(pushResult)) {
                    logger.error(
                        `Failed to push insight card to call ${payload.data.id}: ${pushResult.error.errorMessage}`
                    )
                } else {
                    logger.log(`Pushed insight card to call ${payload.data.id}`)
                }
            }
            break
        }
        case "call.ended":
            return await handleCallEnded(payload.data, phoneNumber)
        default:
            payload satisfies never
            logger.error("Unexpected event", event)
    }
    return new Response(null, {status: 200})
}
