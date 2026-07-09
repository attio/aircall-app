import type {Workflows} from "attio/server"
import {toAircallContact} from "../../../aircall-api/contact"
import {toContactPhone} from "../../../aircall-api/phone"
import type {Call} from "../../../aircall-api/webhook-events"
import {type Direction, MISSED_CALL_REASONS, type MissedCallReason} from "./constants"

type ContactPhone = Workflows.PhoneNumberValue | undefined
type AircallContact = ReturnType<typeof toAircallContact>
type Agent = {id?: number; name?: string; email?: string}
type Comment = {id: number; content: string; postedAt?: Date}
type Tag = {id: number; name: string}

/** Aircall call timestamps are UNIX seconds (UTC); outcome timestamps are JS `Date`s. */
const toDate = (seconds: number): Date => new Date(seconds * 1000)

const toAgent = (user: Call["user"]) => ({
    id: user?.id,
    name: user?.name,
    email: user?.email,
})

const toComments = (comments: Call["comments"]) =>
    (comments ?? []).map((comment) => ({
        id: comment.id,
        content: comment.content,
        postedAt: comment.posted_at != null ? toDate(comment.posted_at) : undefined,
    }))

const toTags = (tags: Call["tags"]) => (tags ?? []).map((tag) => ({id: tag.id, name: tag.name}))

const toMissedCallReason = (reason: string | null | undefined): MissedCallReason | undefined =>
    MISSED_CALL_REASONS.includes(reason as MissedCallReason)
        ? (reason as MissedCallReason)
        : undefined

type AnsweredData = {
    callId: number
    direction: Direction
    startedAt: Date
    answeredAt: Date
    endedAt: Date
    duration?: number
    contactPhone: ContactPhone
    aircallContact: AircallContact
    lineId?: number
    lineName?: string
    agent: Agent
    recording?: string
    comments: Comment[]
    tags: Tag[]
}

/** Called only when `answered_at` is set, so `answeredAt` is guaranteed present (hence the cast). */
export function buildAnswered(call: Call): AnsweredData {
    const answeredAt = call.answered_at as number
    return {
        callId: call.id,
        direction: call.direction as Direction,
        startedAt: toDate(call.started_at),
        answeredAt: toDate(answeredAt),
        endedAt: toDate(call.ended_at),
        duration: call.duration,
        contactPhone: toContactPhone(call.raw_digits),
        aircallContact: toAircallContact(call.contact),
        lineId: call.number?.id,
        lineName: call.number?.name,
        agent: toAgent(call.user),
        recording: call.recording,
        comments: toComments(call.comments),
        tags: toTags(call.tags),
    }
}

type MissedData = {
    callId: number
    direction: Direction
    startedAt: Date
    endedAt: Date
    contactPhone: ContactPhone
    aircallContact: AircallContact
    lineId?: number
    lineName?: string
    agent: Agent
    missedCallReason?: MissedCallReason
    voicemail?: string
    comments: Comment[]
    tags: Tag[]
}

export function buildMissed(call: Call): MissedData {
    return {
        callId: call.id,
        direction: call.direction as Direction,
        startedAt: toDate(call.started_at),
        endedAt: toDate(call.ended_at),
        contactPhone: toContactPhone(call.raw_digits),
        aircallContact: toAircallContact(call.contact),
        lineId: call.number?.id,
        lineName: call.number?.name,
        agent: toAgent(call.user),
        missedCallReason: toMissedCallReason(call.missed_call_reason),
        voicemail: call.voicemail,
        comments: toComments(call.comments),
        tags: toTags(call.tags),
    }
}
