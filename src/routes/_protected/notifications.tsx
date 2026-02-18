import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { toast } from 'sonner';
import type { NotificationPreferences } from '@/account/notification-preferences.schemas';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/account/notification-preferences.functions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';

export const Route = createFileRoute('/_protected/notifications')({
  component: NotificationsPage,
  staticData: { title: 'Notifications' },
});

const PAGE_LAYOUT_CLASS =
  'mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-4 md:py-6 lg:px-6';

const NOTIFICATION_ROW_CLASS =
  'flex items-start justify-between gap-4 py-1 sm:items-center';

const NOTIFICATION_PREFERENCES_QUERY_KEY = [
  'account',
  'notification-preferences',
] as const;

function NotificationsPage() {
  const queryClient = useQueryClient();
  const notificationPreferencesQuery = useQuery({
    queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY,
    queryFn: () => getNotificationPreferences(),
  });

  const updatePreferenceMutation = useMutation({
    mutationFn: async (marketingEmails: boolean) =>
      updateNotificationPreferences({ data: { marketingEmails } }),
    onMutate: async (nextMarketingEmails) => {
      await queryClient.cancelQueries({
        queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY,
      });

      const previousPreferences =
        queryClient.getQueryData<NotificationPreferences>(
          NOTIFICATION_PREFERENCES_QUERY_KEY,
        );

      queryClient.setQueryData<NotificationPreferences>(
        NOTIFICATION_PREFERENCES_QUERY_KEY,
        (currentPreferences) =>
          currentPreferences
            ? { ...currentPreferences, marketingEmails: nextMarketingEmails }
            : {
                emailUpdates: true,
                marketingEmails: nextMarketingEmails,
              },
      );

      return { previousPreferences };
    },
    onSuccess: () => {
      toast.success('Notification preferences updated.');
    },
    onError: (error, _marketingEmails, context) => {
      if (context?.previousPreferences) {
        queryClient.setQueryData(
          NOTIFICATION_PREFERENCES_QUERY_KEY,
          context.previousPreferences,
        );
      }
      toast.error(
        error.message || 'Failed to update notification preferences.',
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: NOTIFICATION_PREFERENCES_QUERY_KEY,
      });
    },
  });

  const marketingEmailsEnabled =
    notificationPreferencesQuery.data?.marketingEmails ?? false;
  const isMarketingToggleDisabled =
    notificationPreferencesQuery.isPending ||
    updatePreferenceMutation.isPending;

  return (
    <div className={PAGE_LAYOUT_CLASS}>
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Choose which notifications you&apos;d like to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notificationPreferencesQuery.isError ? (
            <div className="border-destructive/30 bg-destructive/10 rounded-md border p-3">
              <p className="text-destructive text-sm font-medium">
                Failed to load notification preferences.
              </p>
              <button
                type="button"
                className="text-destructive mt-1 text-sm underline underline-offset-4"
                onClick={() => {
                  void notificationPreferencesQuery.refetch();
                }}
              >
                Retry
              </button>
            </div>
          ) : null}

          <section
            className={NOTIFICATION_ROW_CLASS}
            aria-labelledby="email-updates-title"
          >
            <div className="space-y-1">
              <h2 id="email-updates-title" className="text-sm font-medium">
                Email updates
              </h2>
              <p className="text-sm text-muted-foreground">
                Receive emails about your account activity and security.
              </p>
            </div>
            <Switch
              id="email-updates"
              checked
              disabled
              aria-label="Email updates is enabled and cannot be changed"
            />
          </section>

          <Separator />

          <section
            className={NOTIFICATION_ROW_CLASS}
            aria-labelledby="marketing-emails-title"
          >
            <div className="space-y-1">
              <h2 id="marketing-emails-title" className="text-sm font-medium">
                Marketing emails
              </h2>
              <p className="text-sm text-muted-foreground">
                Receive tips, product updates, and promotional offers.
              </p>
            </div>
            <Switch
              id="marketing-emails"
              checked={marketingEmailsEnabled}
              disabled={isMarketingToggleDisabled}
              onCheckedChange={(nextMarketingEmails) => {
                updatePreferenceMutation.mutate(nextMarketingEmails);
              }}
              aria-label="Toggle marketing emails"
            />
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
