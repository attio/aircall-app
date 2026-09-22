import {Workflows} from "attio/server"

/**
 * Aircall sends the text "anonymous" for a hidden caller ID. A number with no digits matches all
 * the records that have a phone number.
 */
export function normalizeCounterpartyPhone(value: string | undefined): string | undefined {
    if (!value) return undefined

    const trimmed = value.trim()
    if (/anonymous/i.test(trimmed) || !/\d/.test(trimmed)) return undefined

    return trimmed
}

export function toContactPhone(value: string | undefined): Workflows.PhoneNumberValue | undefined {
    const normalized = normalizeCounterpartyPhone(value)
    if (!normalized) return undefined

    return Workflows.OutcomeValue.phoneNumber(normalized) ?? undefined
}
