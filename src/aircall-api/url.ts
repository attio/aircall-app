import {AIRCALL_API_BASE_URL} from "./endpoints"

export type QueryParams = Record<
    string,
    string | number | boolean | undefined | null | string[] | number[]
>

export function buildAuthorizationHeader(apiToken: string): string {
    return `Bearer ${apiToken}`
}

export function buildUrl(path: string, params?: QueryParams): string {
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path
    const url = new URL(normalizedPath, `${AIRCALL_API_BASE_URL}/`)

    if (params) {
        const searchParams = new URLSearchParams()

        for (const [key, value] of Object.entries(params)) {
            if (Array.isArray(value)) {
                for (const item of value) {
                    searchParams.append(key, String(item))
                }
            } else if (value !== null && value !== undefined) {
                searchParams.append(key, String(value))
            }
        }

        url.search = searchParams.toString()
    }

    return url.toString()
}
