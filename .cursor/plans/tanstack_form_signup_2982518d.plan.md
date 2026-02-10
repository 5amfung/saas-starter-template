---
name: TanStack Form Signup
overview: Integrate TanStack Form (client-side) with Zod v4 validation into the signup form, using the existing shadcn/ui Field components and better-auth client for submission.
todos:
  - id: install-deps
    content: Install @tanstack/react-form
    status: completed
  - id: rewrite-form
    content: Rewrite signup-form.tsx with useForm, Zod schema, form.Field bindings, linked password validation, authClient.signUp.email() submission, and Alert for server errors
    status: completed
isProject: false
---

# TanStack Form Signup Integration

## Approach: Client-Side Validation

Client-side `useForm` from `@tanstack/react-form` with Zod v4 schema validation. Server-side validation is unnecessary here because `better-auth` already validates on the backend during `authClient.signUp.email()`. Native HTML5 validation attributes (like `required` and `type="email"`) stay on the inputs for basic browser checks and better mobile keyboards, while TanStack Form + Zod drive the actual error messages and logic.

## Install dependencies

```bash
bun add @tanstack/react-form
```

`@tanstack/react-form-start` is **not** needed since we are doing client-side only.

## Define Zod schema

A Zod v4 object schema for the signup form with a `.refine()` for password matching. Defined at the top of `signup-form.tsx` (or extracted to a shared file if reused elsewhere).

```tsx
import * as z from 'zod'

const signupSchema = z.object({
  name: z.string().min(1, { error: 'Full name is required.' }),
  email: z.email({ error: 'Please enter a valid email address.' }),
  password: z.string().min(10, { error: 'Password must be at least 10 characters.' }),
  confirmPassword: z.string().min(1, { error: 'Please confirm your password.' }),
}).refine((data) => data.password === data.confirmPassword, {
  error: 'Passwords do not match.',
  path: ['confirmPassword'],
})
```

Note: Uses Zod v4 syntax (`z.email()` not `z.string().email()`, `error` not `message`).

## Rewrite [src/components/signup-form.tsx](src/components/signup-form.tsx)

Key changes:

- `**useForm**` wired with `defaultValues`, Zod validation (`onBlur` + `onSubmit`), and `authClient.signUp.email()` submission.
- `**form.Field**` for each input, wired to the existing shadcn/ui `Field`, `FieldLabel`, `FieldError`, and `Input` components.
- **Linked fields** for `confirmPassword` using `onChangeListenTo: ['password']` so re-validation triggers when the password field changes.
- `**form.Subscribe**` for the submit button -- disabled + spinner while submitting.
- `**FormError` component** above the submit button for form-level server errors, rendered via `form.Subscribe` selecting `state.errors`. Styled consistently with `FieldError`.
- Ensure `SignupForm` is a client component (`'use client';` at the top) since it uses React hooks.

### useForm setup

```tsx
import { useForm } from '@tanstack/react-form'
import { useNavigate } from '@tanstack/react-router'
import { authClient } from '@/lib/auth-client'

const navigate = useNavigate()

const form = useForm({
  defaultValues: {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  },
  validators: {
    onBlur: signupSchema,
    onSubmit: signupSchema,
  },
  onSubmit: async ({ value }) => {
    const { error } = await authClient.signUp.email({
      name: value.name,
      email: value.email,
      password: value.password,
    })
    if (error) {
      return { form: error.message ?? 'Something went wrong.' }
    }
    navigate({ to: '/verify' })
  },
})
```

- `**defaultValues**` -- empty strings for all four fields; TanStack Form infers field types from these.
- `**validators.onBlur**` -- the Zod schema runs on blur so users get feedback after leaving a field, not while typing. Errors auto-propagate to matching field names.
- `**onSubmit**` -- calls `authClient.signUp.email()` and returns `{ form: '...' }` on failure to set form-level errors. Navigates to `/` on success.

### Field wiring pattern (repeated for each field)

Each `form.Field` renders the existing shadcn primitives, following the official [shadcn TanStack Form guide](https://ui.shadcn.com/docs/forms/tanstack-form) pattern:

```tsx
<form.Field
  name="email"
  children={(field) => {
    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
    return (
      <Field data-invalid={isInvalid}>
        <FieldLabel htmlFor={field.name}>Email</FieldLabel>
        <Input
          id={field.name}
          name={field.name}
          type="email"
          placeholder="m@example.com"
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
          aria-invalid={isInvalid}
        />
        {isInvalid && <FieldError errors={field.state.meta.errors} />}
      </Field>
    )
  }}
/>
```

Key patterns from the official shadcn guide:

- `isInvalid = field.state.meta.isTouched && !field.state.meta.isValid` -- only show errors after user interaction.
- `data-invalid` on `Field` for error styling, `aria-invalid` on `Input` for accessibility.
- `field.state.meta.errors` passed directly to `FieldError` (the shadcn `FieldError` component accepts this format).
- Conditionally render `FieldError` only when `isInvalid`.

### Password confirmation linked validation

```tsx
<form.Field
  name="confirmPassword"
  validators={{
    onChangeListenTo: ['password'],
    onChange: ({ value, fieldApi }) => {
      if (value !== fieldApi.form.getFieldValue('password')) {
        return 'Passwords do not match.'
      }
      return undefined
    },
  }}
  children={(field) => (/* ... */)}
/>
```

This re-validates `confirmPassword` whenever `password` changes.

### Submit button with disabled state and spinner

Uses `form.Subscribe` to reactively disable the button and show a spinner during submission. The `IconLoader` from `@tabler/icons-react` is the same spinner already used in the project (see `data-table.tsx`).

```tsx
import { IconLoader } from '@tabler/icons-react'

<form.Subscribe
  selector={(state) => [state.canSubmit, state.isSubmitting]}
  children={([canSubmit, isSubmitting]) => (
    <Button type="submit" disabled={!canSubmit || isSubmitting}>
      {isSubmitting && <IconLoader className="animate-spin" />}
      Create Account
    </Button>
  )}
/>
```

- `**disabled={!canSubmit || isSubmitting}**` -- prevents clicks when validation fails or submission is in flight.
- `**IconLoader` with `animate-spin**` -- shows a spinning loader centered in the button alongside the label during submission.

### FormError component

A reusable component for displaying form-level errors, styled consistently with `FieldError`. Defined at the top of `signup-form.tsx` (above the `SignupForm` export):

```tsx
import { cn } from '@/lib/utils'

function FormError({
  className,
  errors,
  ...props
}: React.ComponentProps<'div'> & {
  errors?: string[]
}) {
  if (!errors?.length) {
    return null
  }

  return (
    <div
      role="alert"
      className={cn('text-destructive text-sm font-normal', className)}
      {...props}
    >
      {errors.join(', ')}
    </div>
  )
}
```

**Key styling decisions:**

- `text-destructive text-sm font-normal` -- matches `FieldError` exactly for color, size, and weight.
- No background, border, or icon -- keeps it minimal and consistent with `FieldError`.

**Usage in form:**

```tsx
<form.Subscribe
  selector={(state) => state.errors}
  children={(errors) => <FormError errors={errors} />}
/>
```

## What stays the same

- The `Card`, `CardHeader`, `CardContent` layout wrapper.
- The `Link` to `/login` and the Terms of Service copy.
- The `className` / `...props` passthrough on the outer div.
