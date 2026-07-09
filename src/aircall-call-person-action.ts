import type {App} from "attio"
import {alert, runQuery, showToast} from "attio/client"
import {call} from "./call"
import getCurrentUser from "./queries/getCurrentUser.graphql"
import getPersonPhoneNumbersQuery from "./queries/getPersonPhoneNumbers.graphql"

export const aircallPersonAction: App.Record.Action = {
    id: "aircall-person-button",
    onTrigger: async ({recordId}) => {
        const {hideToast} = await showToast({
            variant: "neutral",
            title: "Looking up phone number...",
            dismissable: false,
            durationMs: Number.POSITIVE_INFINITY,
        })
        const [{person}, {currentUser}] = await Promise.all([
            runQuery(getPersonPhoneNumbersQuery, {recordId}),
            runQuery(getCurrentUser),
        ])
        await hideToast()
        const name = person?.name?.full_name
        const phoneNumber = person?.phone_numbers?.[0]
        if (!phoneNumber) {
            alert({
                title: "No phone number",
                text: "No phone number found for this person.",
            })
            return
        }
        await call({
            name,
            to: phoneNumber,
            currentAttioUserEmail: currentUser.email,
        })
    },
    label: "Call",
    objects: "people",
}
