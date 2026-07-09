import {Workflows, useAsyncCache} from "attio/client"
import getAircallNumbers from "../../server/get-aircall-numbers.server"
import block from "./block"
import {receivedOutcomeSchema} from "./lib/outcome-schema"

export default Workflows.defineConfigurator(block, (workflowBlock) => {
    const {ComboboxInput, Outcome} = Workflows.useConfigurator(workflowBlock.configSchema)

    const {
        values: {numbers},
    } = useAsyncCache({numbers: getAircallNumbers})

    const options = numbers.map((number) => ({
        value: String(number.id),
        label: number.name,
        description: number.digits,
    }))

    return (
        <>
            <ComboboxInput
                name="numberId"
                label="Number"
                disableVariables
                placeholder="Aircall number (leave empty to match all)"
                searchPlaceholder="Search by name or digits"
                options={options}
            />
            <Outcome id="received" schema={receivedOutcomeSchema} />
        </>
    )
})
