import {z} from "zod"

/**
 * Single source of truth for the Aircall Call shape, parsed by both the static note webhook and the
 * call-ended trigger. Deliberately lenient: fields Aircall can omit go through `opt()` so a real
 * event is never rejected over a field we don't read (e.g. `user` is absent on unanswered calls,
 * `number`/`contact` on anonymous calls). Only true `call.ended` invariants (`id`, `direction`,
 * `started_at`, `ended_at`) are required.
 */

/**
 * Optional field that also normalizes Aircall's `null` to `undefined` — the single place we strip
 * nulls, since the Attio outcome layer accepts only `undefined` for "absent", keeping the outcome
 * mapper a pure null-free projection.
 */
const opt = <T extends z.ZodTypeAny>(schema: T) =>
    schema.nullish().transform((value) => value ?? undefined)

const userSchema = z.object({
    id: z.number(),
    direct_link: opt(z.string()),
    name: opt(z.string()),
    email: opt(z.string()),
})

const phoneNumberEntrySchema = z.object({
    value: opt(z.string()),
    label: opt(z.string()),
    id: opt(z.number()),
})

const contactSchema = z.object({
    id: z.number(),
    first_name: opt(z.string()),
    last_name: opt(z.string()),
    // Contact object uses `company_name`; some call payloads use `company`. Keep both.
    company: opt(z.string()),
    company_name: opt(z.string()),
    // `value` is clean E.164; fallback for the sender's phone when top-level `external_number` is absent.
    phone_numbers: opt(z.array(phoneNumberEntrySchema)),
})

const numberSchema = z.object({
    id: z.number(),
    name: opt(z.string()),
    digits: opt(z.string()),
    country: opt(z.string()),
})

const commentSchema = z.object({
    id: z.number(),
    content: z.string(),
    posted_at: opt(z.number()),
    posted_by: opt(userSchema),
})

const tagSchema = z.object({
    id: z.number(),
    name: z.string(),
})

const teamSchema = z.object({
    id: z.number(),
    name: z.string(),
})

const participantSchema = z.object({
    phone_number: opt(z.string()),
    type: opt(z.string()),
    id: opt(z.number()),
    name: opt(z.string()),
})

const ivrOptionSchema = z.object({
    id: z.number(),
    title: opt(z.string()),
    key: opt(z.string()),
    branch: opt(z.string()),
})

const callSchema = z.object({
    id: z.number(),
    call_uuid: opt(z.string()),
    direct_link: opt(z.string()),
    direction: z.string(),
    status: opt(z.string()),
    started_at: z.number(),
    answered_at: opt(z.number()),
    ended_at: z.number(),
    duration: opt(z.number()),
    raw_digits: opt(z.string()),
    missed_call_reason: opt(z.string()),
    recording: opt(z.string()),
    recording_short_url: opt(z.string()),
    voicemail: opt(z.string()),
    voicemail_short_url: opt(z.string()),
    asset: opt(z.string()),
    hangup_cause: opt(z.string()),
    automatic_callback_call_id: opt(z.number()),
    number: opt(numberSchema),
    user: opt(userSchema),
    contact: opt(contactSchema),
    comments: opt(z.array(commentSchema)),
    tags: opt(z.array(tagSchema)),
    teams: opt(z.array(teamSchema)),
    participants: opt(z.array(participantSchema)),
    ivr_options_selected: opt(z.array(ivrOptionSchema)),
})

export type Call = z.infer<typeof callSchema>

const envelope = {
    resource: opt(z.string()),
    timestamp: opt(z.number()),
    token: opt(z.string()),
}

export const callEndedPayloadSchema = z.object({
    ...envelope,
    event: z.literal("call.ended"),
    data: callSchema,
})

const callCreatedPayloadSchema = z.object({
    ...envelope,
    event: z.literal("call.created"),
    // Fires before the call ends, so it carries only early fields, not the full Call object.
    data: z.object({
        id: z.number(),
        call_uuid: opt(z.string()),
        started_at: z.number(),
        raw_digits: opt(z.string()),
    }),
})

export const payloadSchema = z.discriminatedUnion("event", [
    callCreatedPayloadSchema,
    callEndedPayloadSchema,
])

/**
 * Inbound message media (MMS / WhatsApp). Wire shape unconfirmed against a live inbound: docs show
 * `file_name`/`file_type`/`presigned_url` objects, the send-response sample shows a bare string
 * array. Tolerate both — strings normalize to `{presignedUrl}` in the outcome mapper.
 */
const mediaItemSchema = z.union([
    z.string(),
    z.object({
        file_name: opt(z.string()),
        file_type: opt(z.string()),
        presigned_url: opt(z.string()),
    }),
])

export type MediaItem = z.infer<typeof mediaItemSchema>

/**
 * Message timestamp: UNIX milliseconds (send-response sample) or ISO 8601 string (some inbound
 * webhooks). Accept both; the outcome mapper resolves either to a `Date`.
 */
const messageTimestamp = z.union([z.number(), z.string()])

/**
 * Inbound Aircall Message (`message.received` data). Covers SMS, MMS, and inbound WhatsApp; `channel`
 * is `null` for SMS/MMS and `"whatsapp"` for WhatsApp. Maximally lenient (`id` coerced to string,
 * everything else `opt()`, even nested ids) since the wire shape isn't fully pinned and a real
 * inbound must never be rejected over a field we don't read.
 */
const messageSchema = z.object({
    id: z.union([z.string(), z.number()]).transform((value) => String(value)),
    direct_link: opt(z.string()),
    direction: opt(z.string()),
    body: opt(z.string()),
    status: opt(z.string()),
    channel: opt(z.string()),
    // Sender's number on the inbound webhook, display form (e.g. "+44 7474 626067").
    // `raw_digits`/`international_format` only appear on the send-response sample — kept as fallbacks.
    external_number: opt(z.string()),
    raw_digits: opt(z.string()),
    international_format: opt(z.string()),
    created_at: opt(messageTimestamp),
    sent_at: opt(messageTimestamp),
    updated_at: opt(messageTimestamp),
    // Send-response sample uses `media_url`; tolerate a `media` alias too.
    media_url: opt(z.array(mediaItemSchema)),
    media: opt(z.array(mediaItemSchema)),
    number: opt(numberSchema.extend({id: opt(z.number())})),
    contact: opt(contactSchema.extend({id: opt(z.number())})),
})

export type Message = z.infer<typeof messageSchema>

export const messageReceivedPayloadSchema = z.object({
    ...envelope,
    event: z.literal("message.received"),
    data: messageSchema,
})
