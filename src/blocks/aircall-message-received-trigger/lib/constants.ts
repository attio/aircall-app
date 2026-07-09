/**
 * Normalized message channels exposed on the outcome. Aircall's wire value is `null` for SMS/MMS
 * and `"whatsapp"` for WhatsApp; we normalize `null` → `"sms"` so downstream can match meaningful
 * values. MMS is reported as `"sms"` too — branch on `mediaUrl.length > 0` to detect media.
 */
export const CHANNELS = ["sms", "whatsapp"] as const
export type Channel = (typeof CHANNELS)[number]

/** KV key under which a per-activation Aircall webhook id is stored, so deactivate can delete it. */
export const webhookStorageKey = (uniqueActivationId: string): string =>
    `aircall-message-received-webhook:${uniqueActivationId}`
