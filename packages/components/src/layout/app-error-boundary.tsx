import { Link } from '@tanstack/react-router';

interface AppErrorBoundaryProps {
  error?: unknown;
  title?: string;
  message?: string;
  homeTo?: string;
  homeLabel?: string;
  retryLabel?: string;
  onRetry?: () => void;
  showDetails?: boolean;
}

export function AppErrorBoundary({
  error,
  title = 'Something went wrong',
  message = 'The app hit an unexpected error while rendering this page.',
  homeTo = '/',
  homeLabel = 'Go back home',
  retryLabel = 'Try again',
  onRetry,
  showDetails = true,
}: AppErrorBoundaryProps) {
  const details =
    error instanceof Error ? error.message : error ? String(error) : null;

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>

        {showDetails && details ? (
          <pre className="overflow-auto rounded-md border bg-muted p-3 text-left text-xs">
            {details}
          </pre>
        ) : null}

        <div className="flex items-center justify-center gap-3">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              {retryLabel}
            </button>
          ) : null}

          <Link to={homeTo} className="text-sm text-primary hover:underline">
            {homeLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
