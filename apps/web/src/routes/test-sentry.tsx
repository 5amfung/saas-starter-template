import * as Sentry from '@sentry/tanstackstart-react';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/test-sentry')({
  component: TestSentryPage,
});

function TestSentryPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Test Sentry</h1>
      <button
        type="button"
        className="text-destructive-foreground inline-flex w-fit items-center rounded-md bg-destructive px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
        onClick={async () => {
          await Sentry.startSpan(
            {
              name: 'Example Frontend Span',
              op: 'test',
            },
            async () => {
              const res = await fetch('/api/sentry-example');
              if (!res.ok) {
                throw new Error('Sentry Example Frontend Error');
              }
            }
          );
        }}
      >
        Break the world
      </button>
    </main>
  );
}
