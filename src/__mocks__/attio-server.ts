export const getUserConnection = () => ({value: "user-token"})
export const getWorkspaceConnection = () => ({value: "workspace-token"})

export const kv = {
    get: async () => undefined,
    set: async () => undefined,
    delete: async () => undefined,
}

export const Workflows = {
    OutcomeValue: {
        phoneNumber: (value: string) => ({type: "phone-number", value}),
    },
}
