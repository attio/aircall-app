const EMAIL_ADDRESS = /[^\s"'<>()[\]{},;:]+@[^\s"'<>()[\]{},;:]+\.[^\s"'<>()[\]{},;:]+/g

/** `+` and 7+ digits, or 9+ digits, with the usual separators. Dates and status codes are shorter. */
const PHONE_NUMBER = /\+(?:[\s().-]*\d){7,}|\(?\d(?:[\s().-]*\d){8,}/g

/** Attio errors quote the value that failed, which may be an email or phone number. */
export function redactPersonalData(text: string): string {
    return text.replace(EMAIL_ADDRESS, "[REDACTED]").replace(PHONE_NUMBER, "[REDACTED]")
}
