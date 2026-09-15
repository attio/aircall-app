import {Workflows} from "attio/client"
import {DIRECTIONS} from "../../../../aircall-api/call-direction"
import {agentStruct, aircallContactStruct} from "../../../../aircall-api/outcome-structs"
import {MISSED_CALL_REASONS} from "./constants"

const commentStruct = Workflows.OutcomeSchema.struct({
    id: Workflows.OutcomeSchema.number(),
    content: Workflows.OutcomeSchema.string(),
    postedAt: Workflows.OutcomeSchema.timestamp().optional(),
})

const tagStruct = Workflows.OutcomeSchema.struct({
    id: Workflows.OutcomeSchema.number(),
    name: Workflows.OutcomeSchema.string(),
})

export const answeredOutcomeSchema = Workflows.OutcomeSchema.struct({
    callId: Workflows.OutcomeSchema.number(),
    direction: Workflows.OutcomeSchema.stringEnum([...DIRECTIONS]).optional(),
    startedAt: Workflows.OutcomeSchema.timestamp(),
    answeredAt: Workflows.OutcomeSchema.timestamp(),
    endedAt: Workflows.OutcomeSchema.timestamp(),
    duration: Workflows.OutcomeSchema.number().optional(),
    contactPhone: Workflows.OutcomeSchema.phoneNumber().optional(),
    aircallContact: aircallContactStruct,
    lineId: Workflows.OutcomeSchema.number().optional(),
    lineName: Workflows.OutcomeSchema.string().optional(),
    // agent.id binds into Send message's userId.
    agent: agentStruct,
    // Best-effort: may be absent since the trigger fires immediately.
    recording: Workflows.OutcomeSchema.string().optional(),
    comments: Workflows.OutcomeSchema.array(commentStruct),
    tags: Workflows.OutcomeSchema.array(tagStruct),
})

export const missedOutcomeSchema = Workflows.OutcomeSchema.struct({
    callId: Workflows.OutcomeSchema.number(),
    direction: Workflows.OutcomeSchema.stringEnum([...DIRECTIONS]).optional(),
    startedAt: Workflows.OutcomeSchema.timestamp(),
    endedAt: Workflows.OutcomeSchema.timestamp(),
    contactPhone: Workflows.OutcomeSchema.phoneNumber().optional(),
    aircallContact: aircallContactStruct,
    lineId: Workflows.OutcomeSchema.number().optional(),
    lineName: Workflows.OutcomeSchema.string().optional(),
    agent: agentStruct,
    // Populated for inbound, absent for outbound.
    missedCallReason: Workflows.OutcomeSchema.stringEnum([...MISSED_CALL_REASONS]).optional(),
    voicemail: Workflows.OutcomeSchema.string().optional(),
    comments: Workflows.OutcomeSchema.array(commentStruct),
    tags: Workflows.OutcomeSchema.array(tagStruct),
})
