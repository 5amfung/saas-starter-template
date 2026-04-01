import { IconLoader2 } from '@tabler/icons-react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@workspace/ui/components/avatar';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Checkbox } from '@workspace/ui/components/checkbox';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@workspace/ui/components/field';
import { Input } from '@workspace/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { Separator } from '@workspace/ui/components/separator';
import { Skeleton } from '@workspace/ui/components/skeleton';
import { Textarea } from '@workspace/ui/components/textarea';
import { cn } from '@workspace/ui/lib/utils';
import { authClient } from '@workspace/auth/client';
import { getInitials, toFieldErrorItem } from '@workspace/components/lib';
import { adminUserFormSchema } from '@/admin/schemas';

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

const TWO_COLUMN_GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2';
const THREE_COLUMN_GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-3';
const READ_ONLY_INPUT_CLASS = 'bg-muted text-sm';
const READ_ONLY_MONO_INPUT_CLASS = 'bg-muted font-mono text-sm';
const CARD_FOOTER_CLASS = 'flex justify-end gap-2 pt-6';

type AdminUserUpdatePayload = {
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: string | null;
  banned: boolean;
  banReason: string | null;
  banExpires: string | null;
};

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 pt-2">
      <Separator className="my-6" />
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

function SkeletonField({ labelWidth = 'w-20' }: { labelWidth?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className={cn('h-4', labelWidth)} />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}

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

      form.reset(value);
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: AdminUserUpdatePayload) => {
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
            : 'Failed to update user. The email address may already be in use.'
        );
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.setQueryData(
        ['admin', 'user', user.id],
        (prev: UserData | undefined) =>
          prev
            ? {
                ...prev,
                name: variables.name,
                email: variables.email,
                emailVerified: variables.emailVerified,
                image: variables.image,
                role: variables.role,
                banned: variables.banned,
                banReason: variables.banReason,
                banExpires: variables.banExpires
                  ? new Date(variables.banExpires)
                  : null,
              }
            : prev
      );
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

  const initials = getInitials(user.name, user.email);
  const avatarSrc = user.image ?? undefined;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Manage this user&apos;s profile information.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Avatar preview. */}
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
                Avatar is displayed from the stored image URL.
              </p>
            </div>
          </div>

          <FieldGroup className="gap-6">
            {/* Full Name + User ID — two-column. */}
            <div className={TWO_COLUMN_GRID}>
              <form.Field
                name="name"
                children={(field) => {
                  const isInvalid =
                    field.state.meta.isBlurred && !field.state.meta.isValid;
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
                  );
                }}
              />
              <Field>
                <FieldLabel htmlFor="user-id">User ID</FieldLabel>
                <Input
                  id="user-id"
                  value={user.id}
                  readOnly
                  className={READ_ONLY_MONO_INPUT_CLASS}
                />
              </Field>
            </div>

            {/* Email + Email Verified — two-column, aligned with Full Name + User ID. */}
            <div className={TWO_COLUMN_GRID}>
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
              <form.Field
                name="emailVerified"
                children={(field) => (
                  <Field className="flex items-center justify-center">
                    <FieldLabel htmlFor={field.name}>Verified</FieldLabel>
                    <div className="flex w-fit shrink-0 items-center">
                      <Checkbox
                        id={field.name}
                        checked={field.state.value}
                        onCheckedChange={(checked) =>
                          field.handleChange(checked === true)
                        }
                      />
                    </div>
                  </Field>
                )}
              />
            </div>

            {/* Administration — Role only. */}
            <FormSection title="Administration">
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
            </FormSection>

            {/* Ban User — banned checkbox, reason, expires. */}
            <FormSection title="Ban User">
              <p className="text-sm text-muted-foreground">
                Check the box below to ban the user and prevent him from signing
                in.
              </p>
              <div className="space-y-4">
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
              </div>
            </FormSection>

            {/* Activity — timestamps. */}
            <FormSection title="Activity">
              <div className={THREE_COLUMN_GRID}>
                {[
                  {
                    label: 'Last Sign In',
                    value: user.lastSignInAt
                      ? new Date(user.lastSignInAt).toLocaleString()
                      : 'Never',
                  },
                  {
                    label: 'Created At',
                    value: new Date(user.createdAt).toLocaleString(),
                  },
                  {
                    label: 'Updated At',
                    value: new Date(user.updatedAt).toLocaleString(),
                  },
                ].map(({ label, value }) => (
                  <Field key={label}>
                    <FieldLabel>{label}</FieldLabel>
                    <Input
                      value={value}
                      readOnly
                      className={READ_ONLY_INPUT_CLASS}
                    />
                  </Field>
                ))}
              </div>
            </FormSection>
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
  );
}

export function AdminUserFormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-1 h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Avatar row. */}
        <div className="flex items-center gap-4">
          <Skeleton className="size-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Full Name + User ID — two-column. */}
          <div className={TWO_COLUMN_GRID}>
            <SkeletonField labelWidth="w-20" />
            <SkeletonField labelWidth="w-20" />
          </div>

          {/* Email + Verified — two-column. */}
          <div className={TWO_COLUMN_GRID}>
            <SkeletonField labelWidth="w-16" />
            <SkeletonField labelWidth="w-20" />
          </div>

          {/* Administration. */}
          <div className="space-y-4 pt-2">
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-4 w-28" />
            <SkeletonField labelWidth="w-12" />
          </div>

          {/* Ban User. */}
          <div className="space-y-4 pt-2">
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full max-w-md" />
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-4 w-16" />
              </div>
              <SkeletonField labelWidth="w-24" />
              <SkeletonField labelWidth="w-24" />
            </div>
          </div>

          {/* Activity. */}
          <div className="space-y-4 pt-2">
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-4 w-20" />
            <div className={THREE_COLUMN_GRID}>
              <SkeletonField labelWidth="w-24" />
              <SkeletonField labelWidth="w-20" />
              <SkeletonField labelWidth="w-20" />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className={CARD_FOOTER_CLASS}>
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-24" />
      </CardFooter>
    </Card>
  );
}

/** Format a Date to the `datetime-local` input format. */
function formatDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
