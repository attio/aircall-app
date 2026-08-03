// No zod / SDK imports here so both the server zod schema and client outcome schema can share these.

export const DIRECTIONS = ["inbound", "outbound"] as const
export type Direction = (typeof DIRECTIONS)[number]

/**
 * Aircall's documented `missed_call_reason` values. Populated for missed inbound calls; absent
 * for outbound. @see https://developer.aircall.io/api-references/#call
 */
export const MISSED_CALL_REASONS = [
    "out_of_opening_hours",
    "short_abandoned",
    "abandoned_in_ivr",
    "abandoned_in_classic",
    "no_available_agent",
    "agents_did_not_answer",
] as const
export type MissedCallReason = (typeof MISSED_CALL_REASONS)[number]

/** KV key under which a per-activation Aircall webhook id is stored, so deactivate can delete it. */
export const webhookStorageKey = (uniqueActivationId: string): string =>
    `aircall-call-ended-webhook:${uniqueActivationId}`
