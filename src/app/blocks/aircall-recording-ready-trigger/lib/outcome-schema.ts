import {Workflows} from "attio/client"
import {DIRECTIONS} from "../../../../aircall-api/call-direction"
import {agentStruct, aircallContactStruct} from "../../../../aircall-api/outcome-structs"

const baseReadyFields = {
    callId: Workflows.OutcomeSchema.number(),
    direction: Workflows.OutcomeSchema.stringEnum([...DIRECTIONS]).optional(),
    startedAt: Workflows.OutcomeSchema.timestamp(),
    endedAt: Workflows.OutcomeSchema.timestamp(),
    asset: Workflows.OutcomeSchema.string().optional(),
    contactPhone: Workflows.OutcomeSchema.phoneNumber().optional(),
    aircallContact: aircallContactStruct,
    lineId: Workflows.OutcomeSchema.number().optional(),
    lineName: Workflows.OutcomeSchema.string().optional(),
    agent: agentStruct,
}

export const recordingOutcomeSchema = Workflows.OutcomeSchema.struct({
    ...baseReadyFields,
    recording: Workflows.OutcomeSchema.string(),
    recordingShortUrl: Workflows.OutcomeSchema.string().optional(),
})

export const voicemailOutcomeSchema = Workflows.OutcomeSchema.struct({
    ...baseReadyFields,
    voicemail: Workflows.OutcomeSchema.string(),
    voicemailShortUrl: Workflows.OutcomeSchema.string().optional(),
})
