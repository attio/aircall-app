import {Forms, useForm} from "attio/client"

export type Person = {
    name: string
    phoneNumber: string
}

export function AircallCallDialog({
    people,
    onChoose,
}: {
    people: Person[]
    onChoose: (person: Person) => Promise<void>
}) {
    const {Form, Combobox, SubmitButton} = useForm({index: Forms.string()}, {index: "0"})

    return (
        <Form onSubmit={async (state) => await onChoose(people[Number.parseInt(state.index, 10)])}>
            <Combobox
                label="Who do you want to call?"
                name="index"
                options={people.map((person, index) => ({
                    value: String(index),
                    label: person.name,
                }))}
                placeholder="Select a person"
            />
            <SubmitButton label="Call" />
        </Form>
    )
}
