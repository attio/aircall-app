import {Workflows} from "attio/client"
import {aircallContactStruct} from "../../../../aircall-api/outcome-structs"
import {CHANNELS} from "./constants"

const mediaItemStruct = Workflows.OutcomeSchema.struct({
    fileName: Workflows.OutcomeSchema.string().optional(),
    fileType: Workflows.OutcomeSchema.string().optional(),
    presignedUrl: Workflows.OutcomeSchema.string().optional(),
})

export const receivedOutcomeSchema = Workflows.OutcomeSchema.struct({
    messageId: Workflows.OutcomeSchema.string(),
    channel: Workflows.OutcomeSchema.stringEnum([...CHANNELS]),
    receivedAt: Workflows.OutcomeSchema.timestamp().optional(),
    body: Workflows.OutcomeSchema.string().optional(),
    // Empty = pure text; non-empty = MMS / media message.
    media: Workflows.OutcomeSchema.array(mediaItemStruct),
    contactPhone: Workflows.OutcomeSchema.phoneNumber().optional(),
    aircallContact: aircallContactStruct,
    lineId: Workflows.OutcomeSchema.number().optional(),
    lineName: Workflows.OutcomeSchema.string().optional(),
})
