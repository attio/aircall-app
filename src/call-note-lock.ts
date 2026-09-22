import {kv} from "attio/server"
import {z} from "zod"
import {createLogger} from "./utils/logger"

const logger = createLogger("call-note-lock")

// A lock that expires during a run lets a second handler write the same notes.
const PENDING_TTL_SECONDS = 120

// Aircall sends an event again for a maximum of 12 hours.
const RESULT_TTL_SECONDS = 60 * 60 * 4 // 4 hours

const HELD_LOCK_POLL_MS = 5000

const createLockKey = (callId: number) => `call-lock-${callId}`

const lockValueSchema = z.union([
    z.object({
        phase: z.enum(["pending", "partial", "done"]),
        notedRecordIds: z.array(z.string()),
    }),
    // Locks from the versions before we kept a record of each note.
    z.literal("pending").transform(() => ({phase: "pending" as const, notedRecordIds: []})),
    z.literal("processed").transform(() => ({phase: "done" as const, notedRecordIds: []})),
])

type LockValue = z.infer<typeof lockValueSchema>

export function parseLockValue(value: unknown): LockValue | null {
    const result = lockValueSchema.safeParse(value)
    return result.success ? result.data : null
}

export type CallNoteLock =
    | {status: "acquired"; alreadyNoted: ReadonlySet<string>}
    | {status: "already-processed"}
    | {status: "busy"}

async function readLock(lockKey: string): Promise<LockValue | null> {
    const stored = await kv.get(lockKey)
    if (!stored) return null

    const parsed = parseLockValue(stored.value)
    if (!parsed) {
        logger.error("Unexpected call lock value", stored.value)
        // No notes is safer than duplicate notes.
        return {phase: "pending", notedRecordIds: []}
    }

    return parsed
}

async function takeLock(lockKey: string, notedRecordIds: string[]): Promise<CallNoteLock> {
    await kv.set(lockKey, {phase: "pending", notedRecordIds}, {ttlInSeconds: PENDING_TTL_SECONDS})

    return {status: "acquired", alreadyNoted: new Set(notedRecordIds)}
}

/**
 * The kv API has no compare-and-set operation, thus the read and the write are two operations. Two
 * handlers that start at the same moment can get the lock together.
 */
export async function acquireCallNoteLock(
    callId: number,
    retry: boolean = true
): Promise<CallNoteLock> {
    const lockKey = createLockKey(callId)
    const existing = await readLock(lockKey)

    if (existing === null) {
        return await takeLock(lockKey, [])
    }

    switch (existing.phase) {
        case "pending": {
            if (!retry) return {status: "busy"}

            await new Promise((resolve) => setTimeout(resolve, HELD_LOCK_POLL_MS))

            return await acquireCallNoteLock(callId, false)
        }
        case "partial": {
            return await takeLock(lockKey, existing.notedRecordIds)
        }
        case "done": {
            return {status: "already-processed"}
        }
    }
}

export async function completeCallNoteLock(
    callId: number,
    notedRecordIds: string[]
): Promise<void> {
    await kv.set(
        createLockKey(callId),
        {phase: "done", notedRecordIds},
        {ttlInSeconds: RESULT_TTL_SECONDS}
    )
}

export async function recordPartialCallNotes(
    callId: number,
    notedRecordIds: string[]
): Promise<void> {
    await kv.set(
        createLockKey(callId),
        {phase: "partial", notedRecordIds},
        {ttlInSeconds: RESULT_TTL_SECONDS}
    )
}

export async function releaseCallNoteLock(callId: number, notedRecordIds: string[]): Promise<void> {
    if (notedRecordIds.length === 0) {
        await kv.delete(createLockKey(callId))
        return
    }

    await recordPartialCallNotes(callId, notedRecordIds)
}
