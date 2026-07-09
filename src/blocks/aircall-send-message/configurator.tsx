import {Workflows, useAsyncCache} from "attio/client"
import getAircallNumbers from "../../server/get-aircall-numbers.server"
import getAircallUsers from "../../server/get-aircall-users.server"
import block from "./block"
import {rejectedOutcomeSchema, sentOutcomeSchema} from "./lib/outcome-schema"

export default Workflows.defineConfigurator(block, (workflowBlock) => {
    const {ComboboxInput, PhoneNumberInput, TextInput, Outcome} = Workflows.useConfigurator(
        workflowBlock.configSchema
    )

    const {
        values: {numbers, users},
    } = useAsyncCache({numbers: getAircallNumbers, users: getAircallUsers})

    const numberOptions = numbers.map((number) => ({
        value: String(number.id),
        label: number.name,
        description: number.digits,
    }))

    const userOptions = users.map((user) => ({
        value: String(user.id),
        label: user.name,
        description: user.email,
    }))

    return (
        <>
            <ComboboxInput
                name="lineId"
                label="From"
                placeholder="Pick an Aircall number"
                searchPlaceholder="Search by name or digits"
                options={numberOptions}
            />
            <PhoneNumberInput name="to" label="To" placeholder="Bind to a recipient's number" />
            <TextInput name="body" label="Message" placeholder="Text to send" />
            <ComboboxInput
                name="userId"
                label="Send as (optional)"
                placeholder="Attribute to an Aircall user"
                searchPlaceholder="Search by name or email"
                options={userOptions}
            />
            <Outcome id="sent" label="Sent" schema={sentOutcomeSchema} />
            <Outcome id="rejected" label="Rejected" schema={rejectedOutcomeSchema} />
        </>
    )
})
