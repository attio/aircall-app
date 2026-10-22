import {type AsyncResult, complete, isErrored, map, type Result} from "@attio/fetchable"
import {z} from "zod"
import {attio, ATTIO_API_URL} from "../attio/rest/attio"
import type {AttioApiError} from "../attio/rest/error"
import {createLogger} from "../utils/logger"
import {
    ACTIVITY_DEFINITIONS,
    type ActivityDefinition,
    type ActivitySlug,
    type AttributeDefinition,
} from "./activity-definitions"

const logger = createLogger("aircall activities")

const AttributesSchema = z.object({data: z.array(z.object({api_slug: z.string()}))})

/** A CONFLICT means another setup got there first. */
function ignoreConflict(result: Result<unknown, AttioApiError>): Result<void, AttioApiError> {
    return isErrored(result) && result.error.code !== "CONFLICT" ? result : complete(undefined)
}

async function createActivity(definition: ActivityDefinition): AsyncResult<void, AttioApiError> {
    return ignoreConflict(
        await attio.post({
            url: `${ATTIO_API_URL}/activities`,
            body: {
                data: {
                    api_slug: definition.apiSlug,
                    singular_noun: definition.singularNoun,
                    plural_noun: definition.pluralNoun,
                    extends: definition.extends,
                },
            },
            schema: z.unknown(),
        })
    )
}

async function listAttributeSlugs(
    definition: ActivityDefinition
): AsyncResult<ReadonlySet<string>, AttioApiError> {
    return map(
        await attio.get({
            url: `${ATTIO_API_URL}/activities/${definition.apiSlug}/attributes`,
            schema: AttributesSchema,
        }),
        ({data}) => new Set(data.map(({api_slug}) => api_slug))
    )
}

async function createAttribute({
    activity,
    attribute,
}: {
    activity: string
    attribute: AttributeDefinition
}): AsyncResult<void, AttioApiError> {
    return ignoreConflict(
        await attio.post({
            url: `${ATTIO_API_URL}/activities/${activity}/attributes`,
            body: {
                data: {
                    title: attribute.title,
                    description: attribute.description,
                    api_slug: attribute.apiSlug,
                    type: attribute.type,
                    is_required: false,
                    is_unique: attribute.isUnique === true,
                    is_multiselect: false,
                    config: {},
                },
            },
            schema: z.unknown(),
        })
    )
}

/** Whether anything was missing and had to be created. */
async function ensureActivity(definition: ActivityDefinition): AsyncResult<boolean, AttioApiError> {
    const existingResult = await attio.get({
        url: `${ATTIO_API_URL}/activities/${definition.apiSlug}`,
        schema: z.unknown(),
    })
    if (isErrored(existingResult) && existingResult.error.code !== "NOT_FOUND") {
        return existingResult
    }
    const isNew = isErrored(existingResult)

    // A new activity has no attributes to list yet.
    const existingSlugsResult = isNew
        ? map(await createActivity(definition), () => new Set<string>())
        : await listAttributeSlugs(definition)
    if (isErrored(existingSlugsResult)) return existingSlugsResult

    const missingAttributes = definition.attributes.filter(
        ({apiSlug}) => !existingSlugsResult.value.has(apiSlug)
    )
    if (missingAttributes.length === 0) return complete(isNew)

    // One at a time: Attio shows attributes in the order they were created.
    for (const attribute of missingAttributes) {
        const createdResult = await createAttribute({activity: definition.apiSlug, attribute})
        if (isErrored(createdResult)) return createdResult
    }

    return complete(true)
}

/** Adds what a rejected write found missing; true when a second write is worth trying. */
export async function repairActivity(
    activitySlug: ActivitySlug
): AsyncResult<boolean, AttioApiError> {
    return await ensureActivity(ACTIVITY_DEFINITIONS[activitySlug])
}

/** Creates what the workspace is missing. Never updates what exists. */
export async function ensureActivities(): Promise<void> {
    await Promise.all(
        Object.values<ActivityDefinition>(ACTIVITY_DEFINITIONS).map(async (definition) => {
            const result = await ensureActivity(definition)

            if (isErrored(result)) {
                logger.error(
                    `Could not set up the ${definition.apiSlug} activity (${result.error.code})`
                )
            } else if (result.value) {
                logger.log(`Set up the ${definition.apiSlug} activity`)
            }
        })
    )
}
