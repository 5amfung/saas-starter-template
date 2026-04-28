import { IconStack2 } from '@tabler/icons-react';

export function getWebAppName() {
  return import.meta.env.VITE_APP_NAME?.trim() || 'App';
}

export function WebAuthLogo() {
  return (
    <a href="/" className="flex items-center gap-2 self-center font-medium">
      <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <IconStack2 className="size-4" />
      </div>
      {getWebAppName()}
    </a>
  );
}
