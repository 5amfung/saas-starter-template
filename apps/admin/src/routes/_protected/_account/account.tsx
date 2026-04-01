import { createFileRoute } from '@tanstack/react-router';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';
import { Field, FieldLabel } from '@workspace/ui/components/field';
import { Input } from '@workspace/ui/components/input';
import {
  useLinkedAccountsQuery,
  useSessionQuery,
} from '@workspace/components/hooks';
import { AccountProfileForm } from '@/components/account/account-profile-form';
import { ActiveSessionsList } from '@/components/account/active-sessions-list';
import { ChangeEmailDialog } from '@/components/account/change-email-dialog';
import { ChangePasswordDialog } from '@/components/account/change-password-dialog';
import { LinkedAccountsCard } from '@/components/account/linked-accounts-card';
import { SetPasswordDialog } from '@/components/account/set-password-dialog';

export const Route = createFileRoute('/_protected/_account/account')({
  component: AccountPage,
  staticData: { title: 'Account' },
});

const PAGE_LAYOUT_CLASS =
  'mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 md:py-6 lg:px-6';

const READ_ONLY_INPUT_CLASS = 'bg-muted text-sm';

function AccountPage() {
  const { data: session, isPending } = useSessionQuery();
  const { data: accounts } = useLinkedAccountsQuery();

  if (isPending || !session) {
    return null;
  }

  const user = session.user;
  const hasPassword =
    accounts != null
      ? accounts.some((a) => a.providerId === 'credential')
      : null;

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
          <div className="self-end sm:self-auto">
            <ChangeEmailDialog currentEmail={user.email} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            {hasPassword === false
              ? "You signed in with Google. To set a password and sign in with email too, you'll be signed out and we'll send you an email with a link to set a password for this account."
              : 'Update your sign-in password here. When you change it, you will be signed out on this device and all other active sessions will be signed out. Use your new password to sign in again.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-end">
          {hasPassword === true && <ChangePasswordDialog />}
          {hasPassword === false && <SetPasswordDialog email={user.email} />}
        </CardContent>
      </Card>

      <LinkedAccountsCard />
      <ActiveSessionsList />
    </div>
  );
}
