import * as React from 'react';
import * as Sentry from '@sentry/react';

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error: Error) {
    Sentry.captureException(error);
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong.</div>;
    }

    return this.props.children;
  }
}
