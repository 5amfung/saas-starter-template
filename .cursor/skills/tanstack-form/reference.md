# TanStack Form v1 — API Reference

## `useForm` Options

```tsx
import { useForm } from '@tanstack/react-form'

const form = useForm({
  defaultValues: { /* ... */ },
  validators: {
    onChange?: SchemaOrFn,
    onBlur?: SchemaOrFn,
    onSubmit?: SchemaOrFn,
    onChangeAsync?: AsyncSchemaOrFn,
    onBlurAsync?: AsyncSchemaOrFn,
    onSubmitAsync?: AsyncSchemaOrFn,
    onChangeAsyncDebounceMs?: number,
    onBlurAsyncDebounceMs?: number,
  },
  onSubmit: async ({ value, formApi }) => { /* ... */ },
  onSubmitInvalid?: ({ value, formApi }) => { /* ... */ },
  onSubmitMeta?: Record<string, unknown>,
  listeners?: {
    onMount?: ({ formApi }) => void,
    onChange?: ({ formApi, fieldApi }) => void,
    onBlur?: ({ formApi, fieldApi }) => void,
    onSubmit?: ({ formApi }) => void,
    onChangeDebounceMs?: number,
    onBlurDebounceMs?: number,
  },
})
```

## `form.Field` Props

```tsx
<form.Field
  name="fieldName"                      // Type-safe deep key of defaultValues.
  defaultValue?={value}                 // Override default for this field.
  validators?={{
    onChange?: ({ value, fieldApi }) => string | undefined,
    onBlur?: ({ value, fieldApi }) => string | undefined,
    onSubmit?: ({ value, fieldApi }) => string | undefined,
    onChangeAsync?: ({ value, fieldApi, signal }) => Promise<string | undefined>,
    onBlurAsync?: ({ value, fieldApi, signal }) => Promise<string | undefined>,
    onSubmitAsync?: ({ value, fieldApi, signal }) => Promise<string | undefined>,
    onChangeAsyncDebounceMs?: number,
    onBlurAsyncDebounceMs?: number,
    onChangeListenTo?: string[],        // Re-run onChange when these fields change.
    onBlurListenTo?: string[],          // Re-run onBlur when these fields blur.
  }}
  listeners?={{
    onChange?: ({ value }) => void,
    onBlur?: ({ value }) => void,
    onMount?: ({ value }) => void,
    onChangeDebounceMs?: number,
    onBlurDebounceMs?: number,
  }}
  children={(field: FieldApi) => ReactNode}
/>
```

## `FieldApi` (render prop argument)

| Property / Method        | Type / Signature                           | Description                                   |
|--------------------------|--------------------------------------------|-----------------------------------------------|
| `field.name`             | `string`                                   | Field name (use as `id`/`htmlFor`).           |
| `field.state.value`      | `TFieldValue`                              | Current field value.                          |
| `field.state.meta`       | `FieldMeta`                                | Metadata: errors, touched, validation state.  |
| `field.handleChange`     | `(value: TFieldValue) => void`             | Update field value.                           |
| `field.handleBlur`       | `() => void`                               | Mark field as blurred.                        |
| `field.form`             | `FormApi`                                  | Parent form instance.                         |
| `field.pushValue`        | `(value) => void`                          | Array: append item.                           |
| `field.removeValue`      | `(index: number) => void`                  | Array: remove at index.                       |
| `field.insertValue`      | `(index, value) => void`                   | Array: insert at index.                       |
| `field.moveValue`        | `(from, to) => void`                       | Array: move item.                             |
| `field.replaceValue`     | `(index, value) => void`                   | Array: replace at index.                      |
| `field.swapValues`       | `(indexA, indexB) => void`                  | Array: swap two items.                        |
| `field.parseValueWithSchema` | `(schema) => errors \| undefined`      | Manual standard schema validation.            |

## `FieldMeta`

| Property          | Type                              | Description                                   |
|-------------------|-----------------------------------|-----------------------------------------------|
| `isValid`         | `boolean`                         | `true` when no errors present.                |
| `isTouched`       | `boolean`                         | `true` after user interaction.                |
| `isDirty`         | `boolean`                         | `true` when value differs from default.       |
| `isPristine`      | `boolean`                         | Opposite of `isDirty`.                        |
| `isValidating`    | `boolean`                         | `true` during async validation.               |
| `errors`          | `ValidationError[]`               | All current errors (array).                   |
| `errorMap`        | `Record<string, ValidationError>` | Errors keyed by trigger: `onChange`, `onBlur`, etc. |

## `FormApi` (form instance)

| Property / Method            | Description                                          |
|------------------------------|------------------------------------------------------|
| `form.handleSubmit()`        | Trigger form submission (runs validators, then `onSubmit`). |
| `form.reset()`               | Reset to `defaultValues`.                            |
| `form.getFieldValue(name)`   | Get current value of a field by name.                |
| `form.setFieldValue(name, value)` | Programmatically set a field value.            |
| `form.state`                 | Full form state (see `FormState` below).             |
| `form.store`                 | TanStack Store instance for `useStore` subscriptions.|
| `form.Field`                 | Field component bound to this form.                  |
| `form.Subscribe`             | Reactive subscription component.                     |
| `form.AppField`              | Field component with context (from `createFormHook`).|
| `form.AppForm`               | Form context provider (from `createFormHook`).       |

## `FormState` (via `form.Subscribe` or `useStore`)

| Property          | Type       | Description                                    |
|-------------------|------------|------------------------------------------------|
| `values`          | `TFormData`| Current form values.                           |
| `errors`          | `string[]` | Form-level errors.                             |
| `errorMap`        | `Record`   | Form errors keyed by trigger.                  |
| `canSubmit`       | `boolean`  | `false` when invalid and touched.              |
| `isSubmitting`    | `boolean`  | `true` during submission.                      |
| `isSubmitted`     | `boolean`  | `true` after successful submission.            |
| `isPristine`      | `boolean`  | `true` when no field has been modified.        |
| `isDirty`         | `boolean`  | `true` when any field differs from default.    |
| `isTouched`       | `boolean`  | `true` when any field has been touched.        |
| `isValid`         | `boolean`  | `true` when no field or form errors.           |
| `isValidating`    | `boolean`  | `true` during any async validation.            |
| `submissionAttempts` | `number` | How many times submit was attempted.          |

## `form.Subscribe`

Reactive subscription. Only re-renders when selected state changes.

```tsx
<form.Subscribe
  selector={(state) => [state.canSubmit, state.isSubmitting]}
  children={([canSubmit, isSubmitting]) => (
    <Button type="submit" disabled={!canSubmit}>
      {isSubmitting ? '...' : 'Submit'}
    </Button>
  )}
/>
```

## `formOptions`

Share form configuration across client and server.

```tsx
import { formOptions } from '@tanstack/react-form' // or '@tanstack/react-form-start'

export const formOpts = formOptions({
  defaultValues: { firstName: '', age: 0 },
})

// Usage.
const form = useAppForm({ ...formOpts, onSubmit: /* ... */ })
```

## Form Composition API

### `createFormHookContexts`

Creates context objects and hooks for field/form component binding.

```tsx
export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts()
```

### `createFormHook`

Creates `useAppForm` and `withForm` bound to registered components.

```tsx
export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, NumberField, SelectField },
  formComponents: { SubmitButton, ResetButton },
})
```

### `useFieldContext<T>()`

Use inside field components to access the bound `FieldApi`.

```tsx
const field = useFieldContext<string>()
field.state.value    // string
field.handleChange   // (value: string) => void
```

### `useFormContext()`

Use inside form components to access the bound `FormApi`.

```tsx
const form = useFormContext()
form.state.isSubmitting
```

### `withForm`

HOC for breaking large forms into sections with full type safety.

```tsx
const Section = withForm({
  defaultValues: { name: '', email: '' },
  props: { title: 'Section' },
  render: function Render({ form, title }) {
    return (
      <>
        <h2>{title}</h2>
        <form.AppField name="name" children={(f) => <f.TextField label="Name" />} />
      </>
    )
  },
})

// Usage: <Section form={form} title="User Info" />
```

### `withFieldGroup`

Reusable groups of fields across multiple forms (e.g., password + confirm password).

```tsx
const PasswordGroup = withFieldGroup({
  defaultValues: { password: '', confirmPassword: '' },
  render: function Render({ group }) {
    return (
      <>
        <group.AppField name="password" children={(f) => <f.TextField label="Password" />} />
        <group.Field
          name="confirmPassword"
          validators={{
            onChangeListenTo: ['password'],
            onChange: ({ value, fieldApi }) => {
              if (value !== group.getFieldValue('password')) return 'Passwords do not match'
              return undefined
            },
          }}
          children={(f) => /* ... */}
        />
      </>
    )
  },
})
```

## SSR with TanStack Start

### Server-side validation pattern

```tsx
// src/app/form-options.ts
import { formOptions } from '@tanstack/react-form-start'

export const signupFormOpts = formOptions({
  defaultValues: { name: '', email: '', age: 0 },
})
```

```tsx
// src/app/server-functions.ts
import { createServerFn } from '@tanstack/react-start'
import { createServerValidate, ServerValidateError, getFormData } from '@tanstack/react-form-start'
import { signupFormOpts } from './form-options'

const serverValidate = createServerValidate({
  ...signupFormOpts,
  onServerValidate: ({ value }) => {
    if (value.age < 13) return 'Must be at least 13'
  },
})

export const handleSignup = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error('Invalid form data')
    return data
  })
  .handler(async (ctx) => {
    try {
      const validated = await serverValidate(ctx.data)
      // Persist data.
    } catch (e) {
      if (e instanceof ServerValidateError) return e.response
      throw e
    }
    return 'Success'
  })

export const getServerFormData = createServerFn({ method: 'GET' }).handler(async () => {
  return getFormData()
})
```

```tsx
// src/routes/signup.tsx
import { createFileRoute } from '@tanstack/react-router'
import { mergeForm, useForm, useTransform } from '@tanstack/react-form-start'
import { signupFormOpts } from '@/app/form-options'
import { getServerFormData, handleSignup } from '@/app/server-functions'

export const Route = createFileRoute('/signup')({
  component: SignupPage,
  loader: async () => ({ state: await getServerFormData() }),
})

function SignupPage() {
  const { state } = Route.useLoaderData()
  const form = useForm({
    ...signupFormOpts,
    transform: useTransform((base) => mergeForm(base, state), [state]),
    onSubmit: async ({ value }) => { /* client submit */ },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      {/* form fields */}
    </form>
  )
}
```

## Validation Timing Reference

| Validator              | When it runs                                   | Debounce prop                  |
|------------------------|------------------------------------------------|--------------------------------|
| `onChange`             | Every value change                              | —                              |
| `onBlur`              | When field loses focus                          | —                              |
| `onSubmit`            | On form submission                              | —                              |
| `onChangeAsync`       | Every value change (async)                      | `onChangeAsyncDebounceMs`      |
| `onBlurAsync`         | When field loses focus (async)                  | `onBlurAsyncDebounceMs`        |
| `onSubmitAsync`       | On form submission (async)                      | —                              |

Sync validators run first. Async validators only run if sync passes (unless `asyncAlways: true`).

## Standard Schema Support

TanStack Form supports any library implementing the Standard Schema spec:
- **Zod** (v4 — this project's default)
- Valibot
- ArkType

Pass schemas directly to `validators.onChange`, `validators.onBlur`, etc. at form or field level.

```tsx
import * as z from 'zod'

// Form-level — errors auto-propagate to fields.
validators: {
  onChange: z.object({
    email: z.email(),
    password: z.string().min(8),
  }),
}

// Field-level.
<form.Field
  name="email"
  validators={{ onChange: z.email() }}
  children={(field) => /* ... */}
/>
```
