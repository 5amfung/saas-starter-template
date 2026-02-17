import { createFileRoute } from '@tanstack/react-router';
import { ActiveSessionsList } from '@/components/account/active-sessions-list';
import { AccountProfileForm } from '@/components/account/account-profile-form';
import { ChangeEmailDialog } from '@/components/account/change-email-dialog';
import { ChangePasswordDialog } from '@/components/account/change-password-dialog';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useSessionQuery } from '@/hooks/use-session-query';

export const Route = createFileRoute('/_protected/account')({
  component: AccountPage,
  staticData: { title: 'Account' },
});

const PAGE_LAYOUT_CLASS =
  'mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 md:py-6 lg:px-6';

const READ_ONLY_INPUT_CLASS = 'bg-muted text-sm';

function AccountPage() {
  const { data: session, isPending } = useSessionQuery();

  if (isPending || !session) {
    return null;
  }

  const user = session.user;

  return (
    <div className={PAGE_LAYOUT_CLASS}>
      <AccountProfileForm
        user={{
          name: user.name,
          email: user.email,
          image: user.image,
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>
            Your email address for account sign-in and notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <Field className="flex-1">
            <FieldLabel htmlFor="account-email">Email</FieldLabel>
            <Input
              id="account-email"
              type="email"
              value={user.email}
              readOnly
              className={READ_ONLY_INPUT_CLASS}
            />
          </Field>
          <ChangeEmailDialog currentEmail={user.email} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Update your sign-in password. Other active sessions will be signed
            out when it changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-end">
          <ChangePasswordDialog />
        </CardContent>
      </Card>

      <ActiveSessionsList />
    </div>
  );
}
