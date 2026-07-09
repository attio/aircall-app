import {z} from "zod"

const AircallUserSchema = z.object({
    id: z.number(),
    name: z.string(),
    email: z.string(),
})

export type AircallUser = z.infer<typeof AircallUserSchema>

export const AircallUserListPageSchema = z.object({
    users: z.array(AircallUserSchema),
    meta: z.object({
        next_page_link: z.string().nullable(),
    }),
})

const AircallNumberSchema = z.object({
    id: z.number(),
    name: z.string(),
    digits: z.string(),
    country: z.string().nullish(),
})

export type AircallNumber = z.infer<typeof AircallNumberSchema>

export const AircallNumberListPageSchema = z.object({
    numbers: z.array(AircallNumberSchema),
    meta: z.object({
        next_page_link: z.string().nullable(),
    }),
})

/**
 * Native send response. Lenient: only `id` is guaranteed, since the executor reads just
 * id/status/direct_link/sent_at. `created_at`/`sent_at`/`updated_at` are UNIX milliseconds (not seconds).
 */
export const AircallNativeMessageSchema = z.object({
    id: z.string(),
    status: z.string().nullish(),
    direct_link: z.string().nullish(),
    direction: z.string().nullish(),
    created_at: z.number().nullish(),
    sent_at: z.number().nullish(),
    updated_at: z.number().nullish(),
    raw_digits: z.string().nullish(),
    body: z.string().nullish(),
})

export type AircallNativeMessage = z.infer<typeof AircallNativeMessageSchema>

export const AircallDialerCampaign422Schema = z.object({
    error: z.literal("Unprocessable Entity"),
    success: z.literal(false),
    errors: z.object({
        dialer_campaign: z.array(z.string()),
    }),
})

export const AircallDialUnavailableSchema = z.object({
    error: z.literal("Method Not Allowed"),
    troubleshoot: z.literal("The user is currently unavailable"),
    success: z.literal(false),
})

export const AircallCreateWebhookResponseSchema = z.object({
    webhook: z.object({
        webhook_id: z.string(),
    }),
})

type AircallShortTextInsight = {
    type: "shortText"
    label: string
    text: string
    link?: string
}

type AircallTitleInsight = {
    type: "title"
    text: string
    link?: string
}

export type AircallInsightContent = AircallShortTextInsight | AircallTitleInsight
