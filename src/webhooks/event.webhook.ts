import {isErrored} from "@attio/fetchable"
import {kv} from "attio/server"
import {formatDuration} from "date-fns"
import {type AircallInsightContent, pushInsightCard} from "../aircall-api/calls"
import {payloadSchema} from "../aircall-api/webhook-events"
import {createNote} from "../create-note"
import {findPersonRecord} from "../find-person-record"
import {createLogger} from "../utils/logger"

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

const createLockKey = (callId: number) => `call-lock-${callId}`

async function getLock(
    lockKey: string,
    retry: boolean = true
): Promise<"locked" | "processed" | "lock-failed"> {
    const existingCallState = await kv.get(lockKey)

    if (existingCallState === null) {
        await kv.set(lockKey, "pending", {ttlInSeconds: 30})

        return "locked"
    }

    switch (existingCallState.value) {
        case "pending": {
            if (retry) {
                await new Promise((resolve) => setTimeout(resolve, 5000))

                return await getLock(lockKey, false)
            } else {
                return "lock-failed"
            }
        }
        case "processed": {
            return "processed"
        }
        default: {
            logger.error("Unexpected call state", existingCallState)
            return "lock-failed"
        }
    }
}

const PROCESSED_LOCK_TTL = 60 * 60 * 4 // 4 hours

export default async function webhookHandler(req: Request): Promise<Response> {
    const body = await req.json()

    const payloadResult = payloadSchema.safeParse(body)

    if (!payloadResult.success) {
        logger.error("Unexpected payload", payloadResult.error)

        // Return 200 on unparseable payloads so Aircall doesn't retry pointlessly.
        return new Response(null, {status: 200})
    }

    const payload = payloadResult.data
    logger.log(`Received ${payload.event} for call ${payload.data.id}`)

    // raw_digits is the counterparty number we match a Person against; nullish on anonymous calls.
    const phoneNumber = payload.data.raw_digits
    if (!phoneNumber) {
        logger.log(`Call ${payload.data.id} has no counterparty number (raw_digits), skipping`)
        return new Response(null, {status: 200})
    }

    const people = await findPersonRecord(phoneNumber)
    if (!people) {
        logger.log(
            `No matching person record for ${phoneNumber} (call ${payload.data.id}), skipping`
        )
        return new Response(null, {status: 200})
    }
    logger.log(`Matched ${people.length} person record(s) for call ${payload.data.id}`)

    const startedAt = new Date(payload.data.started_at * 1000)
    const {event} = payload
    switch (event) {
        case "call.created": {
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
        case "call.ended": {
            const call = payload.data
            // Nullish in the lenient schema (e.g. `user` absent on unanswered calls); fall back
            // rather than drop the event.
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

            const lockKey = createLockKey(call.id)

            const existingCallState = await getLock(lockKey)

            switch (existingCallState) {
                case "processed":
                    logger.log(`Call ${call.id} already processed, skipping`)
                    return new Response(null, {status: 200})
                case "lock-failed":
                    logger.log(`Could not acquire lock for call ${call.id}`)
                    return new Response(null, {status: 500})
                case "locked": {
                    await Promise.all(
                        people.map((person) =>
                            createNote(person.id.record_id, title, content, startedAt.toISOString())
                        )
                    )
                        .then(async () => {
                            logger.log(`Created ${people.length} note(s) for call ${call.id}`)
                            // If we successfully create the note, we set the lock
                            // to processed so we don't process same call again
                            await kv.set(lockKey, "processed", {
                                ttlInSeconds: PROCESSED_LOCK_TTL,
                            })
                        })
                        .catch(async (error) => {
                            logger.error(`Failed to create note(s) for call ${call.id}`, error)

                            await kv.delete(lockKey)

                            throw error
                        })

                    return new Response(null, {status: 200})
                }
                default: {
                    logger.error("Unexpected call state", existingCallState)
                    return new Response(null, {status: 500})
                }
            }
        }
        default:
            payload satisfies never
            logger.error("Unexpected event", event)
    }
    return new Response(null, {status: 200})
}
