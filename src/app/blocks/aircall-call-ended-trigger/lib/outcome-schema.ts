import {Workflows} from "attio/client"
import {DIRECTIONS, MISSED_CALL_REASONS} from "./constants"

const aircallContactStruct = Workflows.OutcomeSchema.struct({
    id: Workflows.OutcomeSchema.number().optional(),
    name: Workflows.OutcomeSchema.string().optional(),
    firstName: Workflows.OutcomeSchema.string().optional(),
    lastName: Workflows.OutcomeSchema.string().optional(),
    companyName: Workflows.OutcomeSchema.string().optional(),
})

const agentStruct = Workflows.OutcomeSchema.struct({
    id: Workflows.OutcomeSchema.number().optional(),
    name: Workflows.OutcomeSchema.string().optional(),
    email: Workflows.OutcomeSchema.string().optional(),
})

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
    direction: Workflows.OutcomeSchema.stringEnum([...DIRECTIONS]),
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
    direction: Workflows.OutcomeSchema.stringEnum([...DIRECTIONS]),
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
