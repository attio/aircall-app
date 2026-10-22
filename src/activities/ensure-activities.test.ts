import {complete, errored} from "@attio/fetchable"
import {beforeEach, describe, expect, it, vi} from "vitest"
import type {ActivityDefinition} from "./activity-definitions"
import {ensureActivities} from "./ensure-activities"

const mocks = vi.hoisted(() => ({
    attio: {get: vi.fn(), post: vi.fn()},
    logger: {log: vi.fn(), error: vi.fn()},
}))

vi.mock("../attio/rest/attio", () => ({
    attio: mocks.attio,
    ATTIO_API_URL: "https://api.attio.com/v2",
}))
vi.mock("../utils/logger", () => ({createLogger: () => mocks.logger}))
vi.mock("./activity-definitions", () => ({
    ACTIVITY_DEFINITIONS: {
        aircall_calls: {
            apiSlug: "aircall_calls",
            singularNoun: "Aircall call",
            pluralNoun: "Aircall calls",
            extends: "calls",
            attributes: [
                {
                    apiSlug: "aircall_call_id",
                    title: "Aircall call ID",
                    description: "ID",
                    type: "text",
                    isUnique: true,
                },
                {apiSlug: "line", title: "Line", description: "Line", type: "text"},
            ],
        },
        aircall_messages: {
            apiSlug: "aircall_messages",
            singularNoun: "Aircall message",
            pluralNoun: "Aircall messages",
            extends: "interactions",
            attributes: [{apiSlug: "body", title: "Body", description: "Body", type: "text"}],
        },
    } satisfies Record<string, ActivityDefinition>,
}))

type PostedBody = {data: {api_slug: string}}

function postedSlugsFor(activity: string): Array<string> {
    return mocks.attio.post.mock.calls
        .map(([options]) => options as {url: string; body: PostedBody})
        .filter(({url, body}) => body.data.api_slug === activity || url.includes(`/${activity}/`))
        .map(({body}) => body.data.api_slug)
}

function postedData(slug: string): unknown {
    return mocks.attio.post.mock.calls
        .map(([options]) => (options as {body: PostedBody}).body.data)
        .find((data) => data.api_slug === slug)
}

function postedSlugs(): Array<string> {
    return mocks.attio.post.mock.calls.map(
        ([options]) => (options.body as PostedBody).data.api_slug
    )
}

function stubWorkspace(workspace: Record<string, Array<string> | "missing">) {
    mocks.attio.get.mockImplementation(async ({url}: {url: string}) => {
        const slug = Object.keys(workspace).find((candidate) => url.includes(`/${candidate}`))
        const state = slug === undefined ? "missing" : workspace[slug]

        if (url.endsWith("/attributes")) {
            const slugs = state === "missing" || state === undefined ? [] : state
            return complete({data: slugs.map((api_slug) => ({api_slug}))})
        }
        return state === "missing" ? errored({code: "NOT_FOUND"}) : complete({data: {}})
    })
}

beforeEach(() => {
    vi.clearAllMocks()
    mocks.attio.post.mockResolvedValue(complete({}))
})

describe(ensureActivities, () => {
    it("creates missing activities on their schema with all their attributes", async () => {
        stubWorkspace({aircall_calls: "missing", aircall_messages: "missing"})

        await ensureActivities()

        expect(postedSlugsFor("aircall_calls")).toEqual([
            "aircall_calls",
            "aircall_call_id",
            "line",
        ])
        expect(postedSlugsFor("aircall_messages")).toEqual(["aircall_messages", "body"])
        expect(postedData("aircall_calls")).toMatchObject({extends: "calls"})
        expect(postedData("aircall_call_id")).toMatchObject({
            type: "text",
            is_unique: true,
            is_multiselect: false,
        })
        expect(postedData("line")).toMatchObject({type: "text", is_unique: false})
    })

    it("only adds the attributes an existing activity is missing", async () => {
        stubWorkspace({
            aircall_calls: ["timestamp", "direction", "aircall_call_id"],
            aircall_messages: ["body"],
        })

        await ensureActivities()

        expect(postedSlugs()).toEqual(["line"])
    })

    it("carries on when another setup created the activity first", async () => {
        stubWorkspace({aircall_calls: "missing", aircall_messages: ["body"]})
        mocks.attio.post.mockImplementation(async ({body}: {body: PostedBody}) =>
            body.data.api_slug === "aircall_calls" ? errored({code: "CONFLICT"}) : complete({})
        )

        await ensureActivities()

        expect(postedSlugsFor("aircall_calls")).toEqual([
            "aircall_calls",
            "aircall_call_id",
            "line",
        ])
    })

    it("logs a workspace that can't have activities and carries on", async () => {
        stubWorkspace({aircall_calls: "missing", aircall_messages: ["body"]})
        mocks.attio.post.mockResolvedValue(errored({code: "FORBIDDEN"}))

        await expect(ensureActivities()).resolves.toBeUndefined()

        expect(mocks.logger.error).toHaveBeenCalledWith(
            "Could not set up the aircall_calls activity (FORBIDDEN)"
        )
    })
})
