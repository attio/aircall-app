import {isErrored} from "@attio/fetchable"
import {kv} from "attio/server"
import {z} from "zod"
import {listUsers} from "./aircall-api/users"
import {createLogger} from "./utils/logger"

const cachedUserSchema = z.object({
    id: z.number(),
    email: z.string(),
})

type CachedAircallUser = z.infer<typeof cachedUserSchema>

const makeAircallUserByEmailKey = (email: string) => `aircall-user:${email}`
const CACHE_TTL_SECONDS = 60 * 60 * 24 // 1 day

const logger = createLogger("get-aircall-user")

export default async function getAircallUser({
    email,
}: {
    email: string
}): Promise<CachedAircallUser | null> {
    const normalizedEmail = email.toLowerCase()
    const key = makeAircallUserByEmailKey(normalizedEmail)

    const cached = await kv.get(key)
    if (cached !== null) {
        const parsed = cachedUserSchema.safeParse(cached.value)
        if (parsed.success) return parsed.data
    }

    const result = await listUsers()
    if (isErrored(result)) {
        logger.error(`Failed to list Aircall users: ${result.error.errorMessage}`)
        return null
    }

    const user = result.value.find((u) => u.email.toLowerCase() === normalizedEmail)
    if (!user) {
        logger.log(`No Aircall user matches ${normalizedEmail}`)
        return null
    }

    const minimal: CachedAircallUser = {id: user.id, email: user.email}
    await kv.set(key, minimal, {ttlInSeconds: CACHE_TTL_SECONDS})
    return minimal
}
