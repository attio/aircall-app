import {Workflows, useAsyncCache} from "attio/client"
import getAircallUsers from "../../server/get-aircall-users.server"
import block from "./block"

export default Workflows.defineConfigurator(block, (workflowBlock) => {
    const {ComboboxInput, PhoneNumberInput, Outcome} = Workflows.useConfigurator(
        workflowBlock.configSchema
    )

    const {
        values: {users},
    } = useAsyncCache({users: getAircallUsers})

    const options = users.map((user) => ({
        value: String(user.id),
        label: user.name,
        description: user.email,
    }))

    return (
        <>
            <ComboboxInput
                name="aircallUserId"
                label="Aircall user"
                placeholder="Pick an Aircall user"
                searchPlaceholder="Search by name or email"
                options={options}
            />
            <PhoneNumberInput
                name="phoneNumbers"
                label="Phone numbers"
                multi
                placeholder="Bind to a Person's phone numbers"
            />
            <Outcome id="added" schema={null} />
        </>
    )
})
