import {ATTIO_API_TOKEN} from "attio/server"
import {z} from "zod"

const schema = z.array(
    z.object({
        id: z.object({
            workspace_id: z.string(),
            object_id: z.string(),
            record_id: z.string(),
        }),
        values: z.object({
            name: z.array(z.object({full_name: z.string()})),
            primary_location: z.array(z.object({locality: z.string().nullable()})),
            job_title: z.array(z.object({value: z.string()})),
        }),
        web_url: z.string(),
    })
)

export async function findPersonRecord(phoneNumber: string): Promise<Array<{
    id: {
        workspace_id: string
        object_id: string
        record_id: string
    }
    name: string | undefined
    job_title: string | undefined
    location: string | undefined
    web_url: string
}> | null> {
    const normalizedPhoneNumber = phoneNumber.replace(/[^0-9]/g, "")
    const response = await fetch("https://api.attio.com/v2/objects/people/records/query", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ATTIO_API_TOKEN}`,
        },
        body: JSON.stringify({
            filter: {
                phone_numbers: {
                    $contains: normalizedPhoneNumber,
                },
            },
        }),
    })

    if (!response.ok) {
        throw new Error(`Failed to find person record: ${await response.text()}`)
    }

    const json = await response.json()

    const parsed = schema.parse(json.data)
    if (parsed.length === 0) return null

    return parsed.map((person) => ({
        id: person.id,
        name: person.values.name[0]?.full_name,
        job_title: person.values.job_title[0]?.value,
        location: person.values.primary_location[0]?.locality ?? undefined,
        web_url: person.web_url,
    }))
}
