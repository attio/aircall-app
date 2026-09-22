export const ATTIO_API_TOKEN = "attio-api-token"
export const getUserConnection = () => ({value: "user-token"})
export const getWorkspaceConnection = () => ({value: "workspace-token"})

const store = new Map<string, unknown>()

export const kv = {
    get: async (key: string) => (store.has(key) ? {value: store.get(key)} : null),
    set: async (key: string, value: unknown) => {
        store.set(key, value)
    },
    delete: async (key: string) => {
        store.delete(key)
    },
}

export const Workflows = {
    OutcomeValue: {
        phoneNumber: (value: string) => ({type: "phone-number", value}),
    },
}
