import { IconShieldLock } from '@tabler/icons-react';
import type { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
  logo?: ReactNode;
}

const DEFAULT_LOGO = (
  <a href="/" className="flex items-center gap-2 self-center font-medium">
    <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
      <IconShieldLock className="size-4" />
    </div>
    Admin Portal
  </a>
);

export function AuthLayout({ children, logo = DEFAULT_LOGO }: AuthLayoutProps) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div
        data-testid="auth-layout-content"
        className="flex w-full max-w-sm flex-col items-center gap-6"
        style={{ maxWidth: '24rem' }}
      >
        {logo}
        <div className="flex w-full flex-col gap-6">{children}</div>
      </div>
    </div>
  );
}
