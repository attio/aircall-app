import {isErrored} from "@attio/fetchable"
import {Workflows} from "attio/server"
import {addPhoneNumbersToCampaign} from "../../aircall-api/dialer-campaigns"
import {createLogger} from "../../utils/logger"
import block from "./block"

const logger = createLogger("aircall-add-to-dialer-campaign execute")

export default Workflows.defineWorkflowBlockExecute(block, async ({config}) => {
    const aircallUserId = Number(config.aircallUserId)
    if (!Number.isFinite(aircallUserId)) {
        logger.error(`Invalid Aircall user ID: ${config.aircallUserId}`)
        return {
            type: "error",
            errorMessage: `Invalid Aircall user ID: ${config.aircallUserId}`,
            retryable: false,
        }
    }

    const phoneNumbers = config.phoneNumbers
        .map((phoneNumber) => phoneNumber.normalized)
        .filter((normalized): normalized is string => Boolean(normalized))

    if (phoneNumbers.length === 0) {
        logger.error(`No usable phone numbers for user ${aircallUserId}`)
        return {
            type: "error",
            errorMessage: "No phone numbers were provided to add to the dialer campaign.",
            retryable: false,
        }
    }

    logger.log(`Adding ${phoneNumbers.length} number(s) to user ${aircallUserId}'s campaign`)

    const result = await addPhoneNumbersToCampaign(aircallUserId, phoneNumbers)

    if (isErrored(result)) {
        logger.error(
            `Aircall rejected the request for user ${aircallUserId}: ${result.error.errorMessage}`
        )
        return {
            type: "error",
            errorMessage: `Aircall rejected the request: ${result.error.errorMessage}`,
            retryable: false,
        }
    }

    logger.log(`Added ${phoneNumbers.length} number(s) to user ${aircallUserId}'s campaign`)

    return {
        type: "outcome",
        id: "added",
        data: null,
    }
})
