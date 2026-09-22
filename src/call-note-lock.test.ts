import {describe, expect, it} from "vitest"
import {parseLockValue} from "./call-note-lock"

describe(parseLockValue, () => {
    it("reads locks written before per-record tracking existed", () => {
        expect(parseLockValue("pending")).toEqual({phase: "pending", notedRecordIds: []})
        expect(parseLockValue("processed")).toEqual({phase: "done", notedRecordIds: []})
    })
})
