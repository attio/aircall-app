import type {Call} from "./webhook-events"

export type Agent = {id?: number; name?: string; email?: string}

/** Aircall call timestamps are UNIX seconds (UTC); outcome timestamps are JS `Date`s. */
export const toDate = (seconds: number): Date => new Date(seconds * 1000)

export const toAgent = (user: Call["user"]): Agent => ({
    id: user?.id,
    name: user?.name,
    email: user?.email,
})
