const AIRCALL_API_HOST = "https://api.aircall.io"

export const AIRCALL_API_BASE_URL = `${AIRCALL_API_HOST}/v1`

/**
 * @see https://developer.aircall.io/api-references/
 */
export const endpoints = {
    /**
     * Uses v2 — the v1 List all Users endpoint is deprecated.
     *
     * @see https://developer.aircall.io/api-references/#list-all-users-v2
     */
    users: `${AIRCALL_API_HOST}/v2/users`,

    /**
     * @see https://developer.aircall.io/api-references/#list-all-numbers
     */
    numbers: `${AIRCALL_API_BASE_URL}/numbers`,

    /**
     * Agent-conversation send (inbound replies stay on the `message.received` webhook). Not the
     * skip-inbox endpoint.
     *
     * @see https://developer.aircall.io/api-references/#send-message-in-agent-conversation
     */
    nativeSendMessage: (numberId: number) =>
        `${AIRCALL_API_BASE_URL}/numbers/${numberId}/messages/native/send`,

    /**
     * @see https://developer.aircall.io/api-references/#dial-a-phone-number
     */
    dial: (userId: number) => `${AIRCALL_API_BASE_URL}/users/${userId}/dial`,

    /**
     * @see https://developer.aircall.io/api-references/#create-a-dialer-campaign
     */
    dialerCampaign: (userId: number) => `${AIRCALL_API_BASE_URL}/users/${userId}/dialer_campaign`,

    /**
     * @see https://developer.aircall.io/api-references/#push-an-insight-card
     */
    insightCards: (callId: number) => `${AIRCALL_API_BASE_URL}/calls/${callId}/insight_cards`,

    /**
     * @see https://developer.aircall.io/api-references/#create-a-webhook
     */
    webhooks: `${AIRCALL_API_BASE_URL}/webhooks`,

    /**
     * @see https://developer.aircall.io/api-references/#delete-a-webhook
     */
    webhook: (webhookId: string) => `${AIRCALL_API_BASE_URL}/webhooks/${webhookId}`,

    /**
     * @see https://developer.aircall.io/api-references/#disable-an-integration
     */
    disableIntegration: `${AIRCALL_API_BASE_URL}/integrations/disable`,
} as const
