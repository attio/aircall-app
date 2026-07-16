import {Workflows} from "attio/server"

/**
 * Build an Attio phone-number outcome value from an Aircall counterparty number. Returns
 * `undefined` for an unusable number (e.g. an anonymous caller).
 */
export function toContactPhone(value: string | undefined): Workflows.PhoneNumberValue | undefined {
    if (!value) return undefined
    const trimmed = value.trim()
    if (trimmed.length === 0 || /anonymous/i.test(trimmed)) return undefined

    return Workflows.OutcomeValue.phoneNumber(trimmed) ?? undefined
}
