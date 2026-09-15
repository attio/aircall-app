import {defineConfig} from "vitest/config"

export default defineConfig({
    test: {
        include: ["src/**/*.test.ts"],
        passWithNoTests: true,
        environment: "node",
        server: {
            deps: {
                inline: ["attio"],
            },
        },
        alias: {
            "attio/server": new URL("./src/__mocks__/attio-server.ts", import.meta.url).pathname,
        },
    },
})
