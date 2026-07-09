import {ATTIO_API_TOKEN} from "attio/server"
import {createLogger} from "./utils/logger"

const logger = createLogger("create-note")

export async function createNote(
    recordId: string,
    title: string,
    content: string,
    createdAt: string
): Promise<void> {
    const response = await fetch("https://api.attio.com/v2/notes", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ATTIO_API_TOKEN}`,
        },
        body: JSON.stringify({
            data: {
                parent_object: "people",
                parent_record_id: recordId,
                format: "markdown",
                title,
                content,
                created_at: createdAt,
            },
        }),
    })

    if (!response.ok) {
        const text = await response.text()
        logger.error(`Failed to create note for record ${recordId} (${response.status}): ${text}`)
        throw new Error(`Failed to create note: ${text}`)
    }
}
