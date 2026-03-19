import { useForm } from "@tanstack/react-form"
import { Link, useNavigate } from "@tanstack/react-router"
import { IconLoader } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import { authClient } from "@workspace/auth/client"
import { signupSchema } from "@workspace/auth/schemas"
import { FormError } from "@/components/auth/form-error"
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button"
import { toFieldErrorItem } from "@/lib/form-utils"

export function SignupForm() {
  const navigate = useNavigate()

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
    validators: {
      onBlur: signupSchema,
      onSubmit: signupSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      const { error } = await authClient.signUp.email({
        email: value.email,
        password: value.password,
        name: value.email.split("@")[0] ?? "",
        callbackURL: "/ws",
      })
      if (error) {
        const message =
          error.status === 422
            ? "An account with this email already exists. Try signing in with Google or reset your password."
            : (error.message ?? "Something went wrong.")
        formApi.setErrorMap({
          ...formApi.state.errorMap,
          onSubmit: { form: message, fields: {} },
        })
        return
      }
      navigate({ to: "/verify", search: { email: value.email } })
    },
  })

  return (
    <>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Enter your email below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              form.handleSubmit()
            }}
          >
            <FieldGroup>
              <GoogleSignInButton />
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Or continue with
              </FieldSeparator>
              <form.Field
                name="email"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isBlurred && !field.state.meta.isValid
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
                        required
                      />
                      {isInvalid && (
                        <FieldError
                          errors={field.state.meta.errors.map(toFieldErrorItem)}
                        />
                      )}
                    </Field>
                  )
                }}
              />
              <Field>
                <Field className="grid grid-cols-2 gap-4">
                  <form.Field
                    name="password"
                    children={(field) => {
                      const isInvalid =
                        field.state.meta.isBlurred && !field.state.meta.isValid
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="password"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={isInvalid}
                            required
                          />
                          {isInvalid && (
                            <FieldError
                              errors={field.state.meta.errors.map(
                                toFieldErrorItem
                              )}
                            />
                          )}
                        </Field>
                      )
                    }}
                  />
                  <form.Field
                    name="confirmPassword"
                    validators={{
                      onChangeListenTo: ["password"],
                      onChange: ({ value, fieldApi }) => {
                        if (value !== fieldApi.form.getFieldValue("password")) {
                          return "Passwords do not match."
                        }
                        return undefined
                      },
                    }}
                    children={(field) => {
                      const isInvalid =
                        field.state.meta.isBlurred && !field.state.meta.isValid
                      return (
                        <Field data-invalid={isInvalid}>
                          <FieldLabel htmlFor={field.name}>
                            Confirm Password
                          </FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="password"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={isInvalid}
                            required
                          />
                          {isInvalid && (
                            <FieldError
                              errors={field.state.meta.errors.map(
                                toFieldErrorItem
                              )}
                            />
                          )}
                        </Field>
                      )
                    }}
                  />
                </Field>
                <FieldDescription>
                  Must be at least 8 characters long.
                </FieldDescription>
              </Field>
              <form.Subscribe
                selector={(state) => state.errors}
                children={(errors) => (
                  <FormError
                    errors={errors
                      .flatMap((e) => (typeof e === "string" ? [e] : []))
                      .filter(Boolean)}
                  />
                )}
              />
              <Field>
                <form.Subscribe
                  selector={(state) => [state.isSubmitting]}
                  children={([isSubmitting]) => (
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && <IconLoader className="animate-spin" />}
                      Create Account
                    </Button>
                  )}
                />
                <FieldDescription className="text-center">
                  Already have an account? <Link to="/signin">Sign in</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </>
  )
}
