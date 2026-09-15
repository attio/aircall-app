export const DIRECTIONS = ["inbound", "outbound"] as const
export type Direction = (typeof DIRECTIONS)[number]

const isDirection = (value: string): value is Direction =>
    (DIRECTIONS as readonly string[]).includes(value)

/** Returns `undefined` if Aircall ever sends an unrecognized direction; callers should log it. */
export const toDirection = (value: string): Direction | undefined =>
    isDirection(value) ? value : undefined
