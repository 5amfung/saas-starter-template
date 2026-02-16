import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { IconLoader2 } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { authClient } from '@/auth/auth-client';
import { adminUserFormSchema } from '@/admin/schemas';
import { toFieldErrorItem } from '@/lib/form-utils';

interface UserData {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  /** Custom field — present at runtime but may not exist in Better Auth's typed response. */
  lastSignInAt?: Date | string | null;
}

interface AdminUserFormProps {
  user: UserData;
}

const ROLE_OPTIONS = ['user', 'admin'];

export function AdminUserForm({ user }: AdminUserFormProps) {
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: {
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image ?? '',
      role: user.role ?? 'user',
      banned: user.banned ?? false,
      banReason: user.banReason ?? '',
      banExpires: user.banExpires
        ? formatDatetimeLocal(new Date(user.banExpires))
        : '',
    },
    validators: {
      onBlur: adminUserFormSchema,
      onSubmit: adminUserFormSchema,
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        name: value.name,
        email: value.email,
        emailVerified: value.emailVerified,
        image: value.image || null,
        role: value.role || null,
        banned: value.banned,
        banReason: value.banReason || null,
        banExpires: value.banExpires || null,
      });

      // Treat the current values as the new baseline so the form is no longer dirty.
      form.reset(value);
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: {
      name: string;
      email: string;
      emailVerified: boolean;
      image: string | null;
      role: string | null;
      banned: boolean;
      banReason: string | null;
      banExpires: string | null;
    }) => {
      const { error } = await authClient.admin.updateUser({
        userId: user.id,
        data: {
          ...values,
          banExpires: values.banExpires ? new Date(values.banExpires) : null,
        },
      });
      if (error) {
        // Better Auth may return a generic HTTP status text (e.g. "Internal Server
        // Error") when the database throws a constraint violation. Only surface the
        // API message when it is more descriptive than the status text.
        const hasDescriptiveMessage =
          error.message && error.message !== error.statusText;
        throw new Error(
          hasDescriptiveMessage
            ? error.message
            : 'Failed to update user. The email address may already be in use.',
        );
      }
    },
    onSuccess: () => {
      toast.success('User updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({
        queryKey: ['admin', 'user', user.id],
      });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup>
        {/* Read-only: ID. */}
        <Field>
          <FieldLabel htmlFor="user-id">ID</FieldLabel>
          <Input
            id="user-id"
            value={user.id}
            readOnly
            className="bg-muted font-mono text-sm"
          />
        </Field>

        {/* Name. */}
        <form.Field
          name="name"
          children={(field) => {
            const isInvalid =
              field.state.meta.isBlurred && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid || undefined}>
                <FieldLabel htmlFor={field.name}>Name</FieldLabel>
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
            );
          }}
        />

        {/* Email. */}
        <form.Field
          name="email"
          children={(field) => {
            const isInvalid =
              field.state.meta.isBlurred && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid || undefined}>
                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                <Input
                  id={field.name}
                  type="email"
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
            );
          }}
        />

        {/* Email Verified. */}
        <form.Field
          name="emailVerified"
          children={(field) => (
            <Field orientation="horizontal">
              <Checkbox
                id={field.name}
                checked={field.state.value}
                onCheckedChange={(checked) =>
                  field.handleChange(checked === true)
                }
              />
              <FieldLabel htmlFor={field.name}>Email Verified</FieldLabel>
            </Field>
          )}
        />

        {/* Image URL. */}
        <form.Field
          name="image"
          children={(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Image URL</FieldLabel>
              <Input
                id={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="https://…"
              />
            </Field>
          )}
        />

        {/* Role. */}
        <form.Field
          name="role"
          children={(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Role</FieldLabel>
              <Select
                value={field.state.value}
                onValueChange={(v) => {
                  if (v) field.handleChange(v);
                }}
              >
                <SelectTrigger id={field.name}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />

        {/* Banned. */}
        <form.Field
          name="banned"
          children={(field) => (
            <Field orientation="horizontal">
              <Checkbox
                id={field.name}
                checked={field.state.value}
                onCheckedChange={(checked) =>
                  field.handleChange(checked === true)
                }
              />
              <FieldLabel htmlFor={field.name}>Banned</FieldLabel>
            </Field>
          )}
        />

        {/* Ban Reason. */}
        <form.Field
          name="banReason"
          children={(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Ban Reason</FieldLabel>
              <Textarea
                id={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                rows={2}
              />
            </Field>
          )}
        />

        {/* Ban Expires. */}
        <form.Field
          name="banExpires"
          children={(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>Ban Expires</FieldLabel>
              <Input
                id={field.name}
                type="datetime-local"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </Field>
          )}
        />

        {/* Read-only timestamps. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel>Last Sign In</FieldLabel>
            <Input
              value={
                user.lastSignInAt
                  ? new Date(user.lastSignInAt).toLocaleString()
                  : 'Never'
              }
              readOnly
              className="bg-muted text-sm"
            />
          </Field>
          <Field>
            <FieldLabel>Created At</FieldLabel>
            <Input
              value={new Date(user.createdAt).toLocaleString()}
              readOnly
              className="bg-muted text-sm"
            />
          </Field>
          <Field>
            <FieldLabel>Updated At</FieldLabel>
            <Input
              value={new Date(user.updatedAt).toLocaleString()}
              readOnly
              className="bg-muted text-sm"
            />
          </Field>
        </div>

        {/* Submit button. */}
        <form.Subscribe
          selector={(state) => [
            state.isDirty,
            state.isSubmitting,
            state.canSubmit,
          ]}
          children={([isDirty, isSubmitting, canSubmit]) => (
            <Button
              type="submit"
              disabled={!isDirty || !canSubmit || isSubmitting}
            >
              {isSubmitting && <IconLoader2 className="size-4 animate-spin" />}
              Save
            </Button>
          )}
        />
      </FieldGroup>
    </form>
  );
}

export function AdminUserFormSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

/** Format a Date to the `datetime-local` input format. */
function formatDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
