/** The Attio activities this app logs to. Workspaces keep what they have: add, never rename or retype. */

export type AttributeDefinition = {
    apiSlug: string
    title: string
    description: string
    type: "text" | "number" | "phone-number"
    isUnique?: boolean
}

export type ActivityDefinition = {
    apiSlug: string
    singularNoun: string
    pluralNoun: string
    /** `calls` adds direction, participants, caller, outcome and end timestamp. */
    extends: "calls" | "interactions"
    attributes: Array<AttributeDefinition>
}

export const CALLS_ACTIVITY_SLUG = "aircall_calls"
/** Unique, so a resent call updates its record. */
export const CALL_ID_ATTRIBUTE_SLUG = "aircall_call_id"

export const ACTIVITY_DEFINITIONS = {
    [CALLS_ACTIVITY_SLUG]: {
        apiSlug: CALLS_ACTIVITY_SLUG,
        // The timeline says "Aircall logged a call"; the slug keeps the app name.
        singularNoun: "Call",
        pluralNoun: "Calls",
        extends: "calls",
        attributes: [
            {
                apiSlug: "line_name",
                title: "Line name",
                description: "The name of the Aircall number the call went through.",
                type: "text",
            },
            {
                apiSlug: "line_number",
                title: "Line number",
                description: "The Aircall number the call went through.",
                type: "phone-number",
            },
            {
                apiSlug: CALL_ID_ATTRIBUTE_SLUG,
                title: "Aircall call ID",
                description: "The call's ID in Aircall.",
                // Text, so Attio shows it without thousands separators.
                type: "text",
                isUnique: true,
            },
        ],
    },
} satisfies Record<string, ActivityDefinition>

export type ActivitySlug = keyof typeof ACTIVITY_DEFINITIONS
