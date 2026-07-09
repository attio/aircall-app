import type {App} from "attio"
import {aircallAddToCampaignAction} from "./aircall-add-to-dialer-campaign-action"
import {aircallCompanyAction} from "./aircall-call-company-action"
import {aircallPersonAction} from "./aircall-call-person-action"

export const app: App = {
    record: {
        actions: [aircallCompanyAction, aircallPersonAction],
        bulkActions: [aircallAddToCampaignAction],
        widgets: [],
    },
    callRecording: {
        insight: {
            textActions: [],
        },
        summary: {
            textActions: [],
        },
        transcript: {
            textActions: [],
        },
    },
}
