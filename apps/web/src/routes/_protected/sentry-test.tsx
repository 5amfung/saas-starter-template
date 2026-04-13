import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/sentry-test')({
  component: SentryTestPage,
  staticData: { title: 'Sentry Test' },
});

const PAGE_LAYOUT_CLASS =
  'mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-4 md:py-6 lg:px-6';

function SentryTestPage() {
  return (
    <div className={PAGE_LAYOUT_CLASS}>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Sentry Test</h1>
        <p className="text-sm text-muted-foreground">
          Use this page to trigger a client-side error after signing in and
          confirm the event is captured by Sentry.
        </p>
      </div>

      <button
        type="button"
        className="text-destructive-foreground inline-flex w-fit items-center rounded-md bg-destructive px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
        onClick={() => {
          throw new Error('Sentry Test Error');
        }}
      >
        Break the world
      </button>
    </div>
  );
}
