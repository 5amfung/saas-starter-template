---
name: tanstack-form
description: Build type-safe forms using TanStack Form v1 with React. Covers useForm, form.Field, Zod validation, form composition with createFormHook, arrays, linked fields, listeners, SSR with TanStack Start, and integration with shadcn/ui Field components. Use when the user asks to create forms, add form validation, handle form submission, or work with TanStack Form, useForm, or form fields.
---

# TanStack Form (v1) for React

Use `@tanstack/react-form` for all form state management. This project uses Zod v4 for validation schemas.

## Installation

```bash
bun add @tanstack/react-form
```

For TanStack Start SSR support:

```bash
bun add @tanstack/react-form-start
```

## Basic Form with `useForm` + `form.Field`

```tsx
import { useForm } from '@tanstack/react-form'

const form = useForm({
  defaultValues: {
    email: '',
    password: '',
  },
  onSubmit: async ({ value }) => {
    console.log(value)
  },
})

return (
  <form
    onSubmit={(e) => {
      e.preventDefault()
      form.handleSubmit()
    }}
  >
    <form.Field
      name="email"
      children={(field) => (
        <input
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
        />
      )}
    />
  </form>
)
```

## Integrating with shadcn/ui Field Components

This project provides `Field`, `FieldLabel`, `FieldError`, `FieldDescription`, `FieldGroup` from `@/components/ui/field`. Use them inside `form.Field` render props. Use the `data-invalid` attribute on the layout `Field` for error styling.

```tsx
import { useForm } from '@tanstack/react-form'
import { Field, FieldLabel, FieldError, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

function LoginForm() {
  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      await signIn(value)
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <FieldGroup>
        <form.Field
          name="email"
          validators={{
            onBlur: ({ value }) => (!value ? 'Email is required' : undefined),
          }}
          children={(field) => (
            <Field data-invalid={!field.state.meta.isValid || undefined}>
              <FieldLabel htmlFor={field.name}>Email</FieldLabel>
              <Input
                id={field.name}
                type="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              <FieldError errors={field.state.meta.errors.map((e) => ({ message: e }))} />
            </Field>
          )}
        />
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? 'Submitting...' : 'Login'}
            </Button>
          )}
        />
      </FieldGroup>
    </form>
  )
}
```

## Validation

### Field-level with functions

Validators: `onChange`, `onBlur`, `onSubmit`, and async variants `onChangeAsync`, `onBlurAsync`, `onSubmitAsync`.

```tsx
<form.Field
  name="age"
  validators={{
    onChange: ({ value }) => (value < 13 ? 'Must be 13 or older' : undefined),
    onBlurAsync: async ({ value }) => {
      const exists = await checkAge(value)
      return exists ? undefined : 'Invalid age'
    },
    onChangeAsyncDebounceMs: 500,
  }}
  children={(field) => /* ... */}
/>
```

### Form-level with Zod schema

Pass a Zod schema to `validators` on the form. Errors propagate to matching fields automatically.

```tsx
import * as z from 'zod'

const form = useForm({
  defaultValues: { username: '', age: 0 },
  validators: {
    onChange: z.object({
      username: z.string().min(3),
      age: z.number().min(13),
    }),
  },
  onSubmit: async ({ value }) => { /* ... */ },
})
```

### Field-level errors from form validators

Return `{ fields: { fieldName: 'error' } }` from form-level validators to set field-specific errors.

```tsx
validators: {
  onSubmitAsync: async ({ value }) => {
    const errors = await validateOnServer(value)
    if (errors) {
      return {
        form: 'Validation failed',
        fields: {
          email: errors.email,
          'address.city': errors.city,
        },
      }
    }
    return null
  },
}
```

### Displaying errors

```tsx
// All errors as array.
{!field.state.meta.isValid && field.state.meta.errors.join(', ')}

// Errors by trigger event.
{field.state.meta.errorMap['onChange']}
{field.state.meta.errorMap['onBlur']}
```

## Form Composition with `createFormHook`

The recommended approach for production. Define once, reuse across the app.

### Step 1: Create contexts and hook (`src/hooks/form.ts`)

```tsx
import { createFormHookContexts, createFormHook } from '@tanstack/react-form'
import { TextField, NumberField } from '@/components/form-fields'
import { SubmitButton } from '@/components/submit-button'

export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts()

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, NumberField },
  formComponents: { SubmitButton },
})
```

### Step 2: Create bound field components

```tsx
import { useFieldContext } from '@/hooks/form'
import { Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function TextField({ label }: { label: string }) {
  const field = useFieldContext<string>()
  return (
    <Field data-invalid={!field.state.meta.isValid || undefined}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        id={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
      />
      <FieldError errors={field.state.meta.errors.map((e) => ({ message: e }))} />
    </Field>
  )
}
```

### Step 3: Use in forms

```tsx
import { useAppForm } from '@/hooks/form'

function ProfileForm() {
  const form = useAppForm({
    defaultValues: { name: '', age: 0 },
    onSubmit: async ({ value }) => { /* ... */ },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      <form.AppField name="name" children={(field) => <field.TextField label="Name" />} />
      <form.AppField name="age" children={(field) => <field.NumberField label="Age" />} />
      <form.AppForm><form.SubmitButton label="Save" /></form.AppForm>
    </form>
  )
}
```

### Breaking large forms with `withForm`

```tsx
const AddressSection = withForm({
  defaultValues: { name: '', address: { street: '', city: '' } },
  render: function Render({ form }) {
    return (
      <>
        <form.AppField name="address.street" children={(f) => <f.TextField label="Street" />} />
        <form.AppField name="address.city" children={(f) => <f.TextField label="City" />} />
      </>
    )
  },
})

// Usage: <AddressSection form={form} />
```

## Arrays & Dynamic Fields

```tsx
<form.Field
  name="people"
  children={(field) => (
    <>
      {field.state.value.map((_, i) => (
        <form.Field
          key={i}
          name={`people[${i}].name`}
          children={(sub) => (
            <Input
              value={sub.state.value}
              onBlur={sub.handleBlur}
              onChange={(e) => sub.handleChange(e.target.value)}
            />
          )}
        />
      ))}
      <Button type="button" onClick={() => field.pushValue({ name: '', age: 0 })}>
        Add Person
      </Button>
    </>
  )}
/>
```

Array field methods: `pushValue`, `removeValue`, `insertValue`, `moveValue`, `replaceValue`, `swapValues`.

## Linked Fields

Use `onChangeListenTo` to re-validate a field when another field changes.

```tsx
<form.Field name="password" children={(field) => /* password input */} />
<form.Field
  name="confirmPassword"
  validators={{
    onChangeListenTo: ['password'],
    onChange: ({ value, fieldApi }) => {
      if (value !== fieldApi.form.getFieldValue('password')) {
        return 'Passwords do not match'
      }
      return undefined
    },
  }}
  children={(field) => /* confirm password input */}
/>
```

## Listeners (Side Effects)

React to field changes without validation. Events: `onChange`, `onBlur`, `onMount`, `onSubmit`.

```tsx
<form.Field
  name="country"
  listeners={{
    onChange: ({ value }) => {
      form.setFieldValue('province', '')
    },
    onChangeDebounceMs: 300,
  }}
  children={(field) => /* country select */}
/>
```

## Submit Button Pattern

```tsx
<form.Subscribe
  selector={(state) => [state.canSubmit, state.isSubmitting]}
  children={([canSubmit, isSubmitting]) => (
    <Button type="submit" disabled={!canSubmit}>
      {isSubmitting ? 'Submitting...' : 'Submit'}
    </Button>
  )}
/>
```

## Reset

```tsx
<Button
  type="button"
  variant="outline"
  onClick={(e) => {
    e.preventDefault()
    form.reset()
  }}
>
  Reset
</Button>
```

## SSR with TanStack Start

For server-side validation with TanStack Start, see [reference.md](reference.md) for the full `formOptions` + `createServerValidate` + `mergeForm` pattern using `@tanstack/react-form-start`.

## Key Rules

- Always call `e.preventDefault()` in the form's `onSubmit` handler before `form.handleSubmit()`.
- Use `form.Field` for one-off forms; use `form.AppField` with `createFormHook` for production.
- Wrap `form.Field` render content with shadcn `Field` + `FieldLabel` + `FieldError` for consistent styling.
- Use Zod v4 schemas (not v3) — see the `zod-schema` skill for correct syntax.
- Use `form.Subscribe` for reactive UI (submit buttons, error summaries) to avoid unnecessary re-renders.
- Named function expressions in `withForm`'s `render` avoid ESLint hook warnings.

## Additional Resources

- For complete API reference, see [reference.md](reference.md).
