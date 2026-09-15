import type {SummaryData} from "../../../../aircall-api/webhook-events"

type SummaryReadyData = {
    callId: number
    summary?: string
}

export function buildSummaryReady(data: SummaryData): SummaryReadyData {
    return {
        callId: data.call_id,
        summary: data.content,
    }
}
