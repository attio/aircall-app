import {describe, expect, it} from "vitest"
import {redactPersonalData} from "./redact-personal-data"

describe(redactPersonalData, () => {
    it("redacts every email in an Attio error message", () => {
        expect(
            redactPersonalData(
                'value_not_found: Cannot find target record with value "[{"email_address":"ada@example.com"}]" or grace@example.co.uk'
            )
        ).toBe(
            'value_not_found: Cannot find target record with value "[{"email_address":"[REDACTED]"}]" or [REDACTED]'
        )
    })

    it("redacts phone numbers but leaves short numbers such as status codes", () => {
        expect(
            redactPersonalData(
                'Cannot find target record with value "+44 7700 900123" or "(555) 123-4567"; status 400, 10 records'
            )
        ).toBe(
            'Cannot find target record with value "[REDACTED]" or "[REDACTED]"; status 400, 10 records'
        )
    })

    it("leaves dates and timestamps alone", () => {
        const message = 'Timestamp "2026-10-16T09:44:00.000Z" is before 2026-10-16'

        expect(redactPersonalData(message)).toBe(message)
    })
})
