import type {Workflows} from "attio/server"
import {toAircallContact} from "../../../aircall-api/contact"
import {toContactPhone} from "../../../aircall-api/phone"
import type {MediaItem, Message} from "../../../aircall-api/webhook-events"
import {CHANNELS, type Channel} from "./constants"

type ContactPhone = Workflows.PhoneNumberValue | undefined
type AircallContact = ReturnType<typeof toAircallContact>
type MediaItem2 = {fileName?: string; fileType?: string; presignedUrl?: string}

type ReceivedData = {
    messageId: string
    channel: Channel
    receivedAt?: Date
    body?: string
    media: MediaItem2[]
    contactPhone: ContactPhone
    aircallContact: AircallContact
    lineId?: number
    lineName?: string
}

/**
 * Resolve an Aircall message timestamp to a Date. Numbers are UNIX ms (we guard against a seconds
 * value just in case); strings are ISO 8601.
 */
const toDate = (value: number | string | undefined): Date | undefined => {
    if (value == null) return undefined
    if (typeof value === "string") return new Date(value)
    return new Date(value < 1e12 ? value * 1000 : value)
}

/** Aircall's channel is `null` for SMS/MMS and `"whatsapp"` for WhatsApp. */
const toChannel = (channel: string | undefined): Channel =>
    channel === "whatsapp" ? "whatsapp" : CHANNELS[0]

const toMedia = (media: MediaItem[] | undefined) =>
    (media ?? []).map((item) =>
        typeof item === "string"
            ? {presignedUrl: item}
            : {
                  fileName: item.file_name,
                  fileType: item.file_type,
                  presignedUrl: item.presigned_url,
              }
    )

export function buildReceived(message: Message): ReceivedData {
    // Sender's number: `external_number` on the real webhook, falling back to the matched contact's
    // stored number, then the send-response-style fields.
    const senderPhone =
        message.external_number ??
        message.contact?.phone_numbers?.[0]?.value ??
        message.international_format ??
        message.raw_digits

    return {
        messageId: message.id,
        channel: toChannel(message.channel),
        receivedAt: toDate(message.created_at ?? message.sent_at),
        body: message.body,
        media: toMedia(message.media_url ?? message.media),
        contactPhone: toContactPhone(senderPhone),
        aircallContact: toAircallContact(message.contact),
        lineId: message.number?.id,
        lineName: message.number?.name,
    }
}
