import { useForm } from "@tanstack/react-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { IconLoader2 } from "@tabler/icons-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { authClient } from "@/auth/auth-client"
import { accountProfileSchema } from "@/account/schemas"
import { SESSION_QUERY_KEY } from "@/hooks/use-session-query"
import { getInitials } from "@/lib/get-initials"
import { toFieldErrorItem } from "@/lib/form-utils"

const CARD_FOOTER_CLASS = "flex justify-end gap-2 pt-6"

interface AccountProfileFormProps {
  user: {
    name: string
    email: string
    image?: string | null
  }
}

export function AccountProfileForm({ user }: AccountProfileFormProps) {
  const queryClient = useQueryClient()

  const form = useForm({
    defaultValues: {
      name: user.name,
    },
    validators: {
      onBlur: accountProfileSchema,
      onSubmit: accountProfileSchema,
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({ name: value.name })
      form.reset(value)
    },
  })

  const mutation = useMutation({
    mutationFn: async (payload: { name: string }) => {
      const { error } = await authClient.updateUser({ name: payload.name })
      if (error) throw new Error(error.message)
    },
    onSuccess: (_data, variables) => {
      // Optimistic update.
      queryClient.setQueryData(
        SESSION_QUERY_KEY,
        (prev: { user: { name: string } } | null | undefined) =>
          prev
            ? { ...prev, user: { ...prev.user, name: variables.name } }
            : prev
      )
      toast.success("Profile updated.")
      queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY })
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update profile.")
    },
  })

  const initials = getInitials(user.name, user.email)
  const avatarSrc = user.image ?? undefined

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        form.handleSubmit()
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your profile information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex items-center gap-4">
            <Avatar className="size-20">
              <AvatarImage
                src={avatarSrc}
                alt={user.name}
                className="object-cover"
              />
              <AvatarFallback className="text-xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="text-sm font-medium">Profile Photo</p>
              <p className="text-xs text-muted-foreground">
                Displayed from your sign-in provider. Read-only.
              </p>
            </div>
          </div>

          <FieldGroup className="gap-6">
            <form.Field
              name="name"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isBlurred && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid || undefined}>
                    <FieldLabel htmlFor={field.name}>Full Name</FieldLabel>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
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
          </FieldGroup>
        </CardContent>
        <CardFooter className={CARD_FOOTER_CLASS}>
          <form.Subscribe
            selector={(state) => [
              state.isDirty,
              state.isSubmitting,
              state.canSubmit,
            ]}
            children={([isDirty, isSubmitting, canSubmit]) => (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.reset()}
                  disabled={!isDirty || isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!isDirty || !canSubmit || isSubmitting}
                >
                  {isSubmitting && (
                    <IconLoader2 className="size-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </>
            )}
          />
        </CardFooter>
      </Card>
    </form>
  )
}
