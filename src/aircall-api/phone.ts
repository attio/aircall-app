import {Workflows} from "attio/server"

function toE164(value: string | undefined): string | undefined {
    if (!value) return undefined
    const trimmed = value.trim()
    if (trimmed.length === 0 || /anonymous/i.test(trimmed)) return undefined
    const digits = trimmed.replace(/\D/g, "")
    if (digits.length === 0) return undefined
    // Keep a leading `+` so the result is true E.164.
    return trimmed.startsWith("+") ? `+${digits}` : digits
}

/**
 * Build an Attio phone-number outcome value from an Aircall counterparty number. `original` is the
 * verbatim input, `normalized` is E.164. `country_code` is left empty: Aircall never reports the
 * counterparty's ISO country, and the full-E.164 `+` prefix already encodes it (matching uses
 * `normalized`). Returns `undefined` for an unusable number (e.g. an anonymous caller).
 */
export function toContactPhone(value: string | undefined): Workflows.PhoneNumberValue | undefined {
    if (!value) return undefined
    const normalized = toE164(value)
    if (normalized === undefined) return undefined

    return Workflows.phoneNumberValue({
        original: value,
        normalized,
        country_code: "",
    })
}
