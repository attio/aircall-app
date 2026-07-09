import type {App} from "attio"
import {runQuery, showDialog, showToast} from "attio/client"
import type {Person} from "./aircall-call-dialog"
import {AircallCallDialog} from "./aircall-call-dialog"
import {call} from "./call"
import query from "./queries/getCallablePeopleInCompany.graphql"
import getCurrentUser from "./queries/getCurrentUser.graphql"

export const aircallCompanyAction: App.Record.Action = {
    id: "aircall-company-button",
    onTrigger: async ({recordId}) => {
        const {hideToast} = await showToast({
            variant: "neutral",
            title: "Looking up phone numbers...",
            dismissable: false,
            durationMs: Number.POSITIVE_INFINITY,
        })
        const [{company}, {currentUser}] = await Promise.all([
            runQuery(query, {recordId}),
            runQuery(getCurrentUser),
        ])
        await hideToast()

        // Filter down to people with full_name and a phone number
        const people = (company?.team
            .map((person) => ({
                name: person.name?.full_name,
                phoneNumber: person.phone_numbers?.[0],
            }))
            .filter((person) => person.name && person.phoneNumber) ?? []) as Person[]

        if (!people.length) {
            showToast({
                title: "No phone numbers for anyone in this company.",
                variant: "error",
            })
            return
        }
        if (people.length === 1) {
            await call({
                name: people[0].name,
                to: people[0].phoneNumber,
                currentAttioUserEmail: currentUser.email,
            })
            return
        }
        await showDialog({
            title: "Call now",
            Dialog: ({hideDialog}: {hideDialog: () => void}) => (
                <AircallCallDialog
                    people={people}
                    onChoose={async (person) => {
                        hideDialog()
                        await call({
                            name: person.name,
                            to: person.phoneNumber,
                            currentAttioUserEmail: currentUser.email,
                        })
                    }}
                />
            ),
        })
    },
    label: "Call",
    objects: "companies",
}
