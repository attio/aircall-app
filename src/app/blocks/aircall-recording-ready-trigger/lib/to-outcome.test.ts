import {describe, expect, it} from "vitest"
import type {Call} from "../../../../aircall-api/webhook-events"
import {buildReady} from "./to-outcome"

const baseCall: Call = {
    id: 42,
    direction: "inbound",
    started_at: 1_700_000_000,
    ended_at: 1_700_000_060,
}

describe(buildReady, () => {
    it("fires a recording outcome when call.recording is set", () => {
        const result = buildReady({...baseCall, recording: "https://example.com/recording.mp3"})

        expect(result.type).toBe("recording")
        if (result.type !== "recording") throw new Error("expected recording outcome")
        expect(result.data.recording).toBe("https://example.com/recording.mp3")
        expect(result.data.startedAt).toEqual(new Date(1_700_000_000 * 1000))
        expect(result.data.endedAt).toEqual(new Date(1_700_000_060 * 1000))
    })

    it("fires a voicemail outcome when call.voicemail is set", () => {
        const result = buildReady({...baseCall, voicemail: "https://example.com/voicemail.mp3"})

        expect(result.type).toBe("voicemail")
        if (result.type !== "voicemail") throw new Error("expected voicemail outcome")
        expect(result.data.voicemail).toBe("https://example.com/voicemail.mp3")
    })

    it("prefers recording over voicemail when both are somehow set", () => {
        const result = buildReady({
            ...baseCall,
            recording: "https://example.com/recording.mp3",
            voicemail: "https://example.com/voicemail.mp3",
        })

        expect(result.type).toBe("recording")
    })

    it("falls back to unrecognized when neither recording nor voicemail is set", () => {
        expect(buildReady(baseCall).type).toBe("unrecognized")
    })

    it("passes through a recognized direction", () => {
        const result = buildReady({...baseCall, direction: "outbound", recording: "x"})

        expect(result.type).toBe("recording")
        if (result.type !== "recording") throw new Error("expected recording outcome")
        expect(result.data.direction).toBe("outbound")
    })

    it("falls back to undefined for an unrecognized direction rather than mislabeling the call", () => {
        const result = buildReady({...baseCall, direction: "conference", recording: "x"})

        expect(result.type).toBe("recording")
        if (result.type !== "recording") throw new Error("expected recording outcome")
        expect(result.data.direction).toBeUndefined()
    })
})
