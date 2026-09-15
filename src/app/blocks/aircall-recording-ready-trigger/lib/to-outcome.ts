import type {Workflows} from "attio/server"
import {type Direction, toDirection} from "../../../../aircall-api/call-direction"
import {type Agent, toAgent, toDate} from "../../../../aircall-api/call-outcome-fields"
import {toAircallContact} from "../../../../aircall-api/contact"
import {toContactPhone} from "../../../../aircall-api/phone"
import type {Call} from "../../../../aircall-api/webhook-events"
import {createLogger} from "../../../../utils/logger"

const logger = createLogger("aircall-recording-ready-trigger to-outcome")

type ContactPhone = Workflows.PhoneNumberValue | undefined
type AircallContact = ReturnType<typeof toAircallContact>

type ReadyBase = {
    callId: number
    direction?: Direction
    startedAt: Date
    endedAt: Date
    asset?: string
    contactPhone: ContactPhone
    aircallContact: AircallContact
    lineId?: number
    lineName?: string
    agent: Agent
}

export type RecordingReadyData = ReadyBase & {recording: string; recordingShortUrl?: string}
export type VoicemailReadyData = ReadyBase & {voicemail: string; voicemailShortUrl?: string}

export type ReadyOutcome =
    | {type: "recording"; data: RecordingReadyData}
    | {type: "voicemail"; data: VoicemailReadyData}
    | {type: "unrecognized"}

function buildBase(call: Call): ReadyBase {
    const direction = toDirection(call.direction)
    if (direction === undefined) {
        logger.error(`Unrecognized call direction "${call.direction}"`, {callId: call.id})
    }

    return {
        callId: call.id,
        direction,
        startedAt: toDate(call.started_at),
        endedAt: toDate(call.ended_at),
        asset: call.asset,
        contactPhone: toContactPhone(call.raw_digits),
        aircallContact: toAircallContact(call.contact),
        lineId: call.number?.id,
        lineName: call.number?.name,
        agent: toAgent(call.user),
    }
}

export function buildReady(call: Call): ReadyOutcome {
    const base = buildBase(call)

    if (call.recording) {
        return {
            type: "recording",
            data: {...base, recording: call.recording, recordingShortUrl: call.recording_short_url},
        }
    }

    if (call.voicemail) {
        return {
            type: "voicemail",
            data: {...base, voicemail: call.voicemail, voicemailShortUrl: call.voicemail_short_url},
        }
    }

    return {type: "unrecognized"}
}
