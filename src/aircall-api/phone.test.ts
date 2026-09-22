import {describe, expect, it} from "vitest"
import {normalizeCounterpartyPhone} from "./phone"

describe(normalizeCounterpartyPhone, () => {
    it("keeps a usable number, trimmed", () => {
        expect(normalizeCounterpartyPhone("  +44 7474 626067 ")).toBe("+44 7474 626067")
    })

    it("rejects a withheld caller ID", () => {
        expect(normalizeCounterpartyPhone("anonymous")).toBeUndefined()
        expect(normalizeCounterpartyPhone("Anonymous")).toBeUndefined()
    })

    it("rejects a number with no digits", () => {
        expect(normalizeCounterpartyPhone("+")).toBeUndefined()
        expect(normalizeCounterpartyPhone("unknown")).toBeUndefined()
    })

    it("rejects an absent or blank number", () => {
        expect(normalizeCounterpartyPhone(undefined)).toBeUndefined()
        expect(normalizeCounterpartyPhone("   ")).toBeUndefined()
    })
})
