import type {Call, Message} from "./webhook-events"

export const toAircallContact = (contact: Call["contact"] | Message["contact"]) => {
    const name = [contact?.first_name, contact?.last_name].filter(Boolean).join(" ")
    return {
        id: contact?.id,
        name: name.length > 0 ? name : undefined,
        firstName: contact?.first_name,
        lastName: contact?.last_name,
        companyName: contact?.company_name ?? contact?.company,
    }
}
