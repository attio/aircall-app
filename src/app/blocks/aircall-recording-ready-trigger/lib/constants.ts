/** KV key under which a per-activation Aircall webhook id is stored, so deactivate can delete it. */
export const webhookStorageKey = (uniqueActivationId: string): string =>
    `aircall-recording-ready-webhook:${uniqueActivationId}`
