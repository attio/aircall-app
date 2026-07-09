import {isErrored} from "@attio/fetchable"
import type {App} from "attio"
import {alert, runQuery, showToast} from "attio/client"
import addNumbersToDialerCampaign from "./add-numbers-to-dialer-campaign.server"
import getAircallUser from "./get-aircall-user.server"
import getCurrentUserQuery from "./queries/getCurrentUser.graphql"
import getPeoplePhoneNumbersQuery from "./queries/getPeoplePhoneNumbers.graphql"
import {createLogger} from "./utils/logger"

const logger = createLogger("aircall-add-to-campaign action")

export const aircallAddToCampaignAction: App.Record.BulkAction = {
    id: "aircall-add-to-campaign",
    onTrigger: async ({runRecordBatches}) => {
        const {hideToast} = await showToast({
            variant: "neutral",
            title: "Adding numbers to Power Dialer campaign...",
            dismissable: false,
            durationMs: Number.POSITIVE_INFINITY,
        })

        try {
            const {currentUser} = await runQuery(getCurrentUserQuery)
            const aircallUser = await getAircallUser({email: currentUser.email})

            if (!aircallUser) {
                alert({
                    title: "Cannot use Aircall",
                    text: "You need an Aircall user account to access Power Dialer campaigns.",
                })
                return
            }

            const outcome = await runRecordBatches({batchSize: 250}, async (batch) => {
                const {people} = await runQuery(getPeoplePhoneNumbersQuery, {
                    recordIds: batch.recordIds,
                })
                return people.records.flatMap((person) => person?.phone_numbers ?? [])
            })

            if (!outcome.success) {
                await showToast({variant: "error", title: "Error fetching phone numbers"})
                return
            }

            const phoneNumbers = new Set(outcome.results.flat())

            if (phoneNumbers.size === 0) {
                await showToast({
                    variant: "error",
                    title: "No phone numbers for anyone in the selection.",
                })
                return
            }

            const result = await addNumbersToDialerCampaign(aircallUser.id, [...phoneNumbers])

            if (isErrored(result)) {
                await showToast({
                    variant: "error",
                    title: "Error creating campaign",
                    text: result.error.errorMessage,
                })
            } else {
                await showToast({
                    variant: "success",
                    title: `Added ${phoneNumbers.size} number${phoneNumbers.size > 1 ? "s" : ""} to Power Dialer campaign.`,
                })
            }
        } catch (error) {
            logger.error("Error adding numbers to Power Dialer campaign", error)
            await showToast({
                variant: "error",
                title: "Error adding numbers to Power Dialer campaign",
                text: error instanceof Error ? error.message : undefined,
            })
        } finally {
            await hideToast()
        }
    },
    label: "Add to dialer campaign",
    objects: ["people"],
}
