import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/account')({
  component: AccountPage,
  staticData: { title: 'Account' },
});

function AccountPage() {
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <div className="text-center">
        <h2 className="text-lg font-medium">Account</h2>
        <p className="text-muted-foreground text-sm">Coming soon.</p>
      </div>
    </div>
  );
}
