import {isErrored} from "@attio/fetchable"
import {alert, confirm, showToast} from "attio/client"
import dial from "./dial.server"
import getAircallUser from "./get-aircall-user.server"

/**
 * Calls a number, with a retry confirmation if the Aircall app isn't open.
 */
export async function call({
    name,
    to,
    currentAttioUserEmail,
}: {
    name: string | null | undefined
    to: string
    currentAttioUserEmail: string
}) {
    const aircallUser = await getAircallUser({email: currentAttioUserEmail})

    if (!aircallUser) {
        alert({
            title: "Cannot use Aircall",
            text: "You need an Aircall user account to make calls.",
        })
        return
    }

    const tryCall = async () => {
        const {hideToast} = await showToast({
            variant: "neutral",
            title: name ? `Dialing ${name}...` : "Dialing...",
            text: "Make sure the Aircall app is open.",
            dismissable: false,
            durationMs: Number.POSITIVE_INFINITY,
        })
        try {
            const result = await dial(aircallUser.id, to)

            if (!isErrored(result)) {
                return
            }

            const error = result.error
            if ("kind" in error && error.kind === "user-unavailable") {
                if (
                    await confirm({
                        title: "App Not Open",
                        text: "Please open the Aircall app to make a call.",
                        confirmLabel: "Try Again",
                        cancelLabel: "Cancel",
                    })
                ) {
                    await tryCall()
                }
                return
            }

            await showToast({
                variant: "error",
                title: "Error",
                text: error.errorMessage,
            })
        } finally {
            await hideToast()
        }
    }

    await tryCall()
}
