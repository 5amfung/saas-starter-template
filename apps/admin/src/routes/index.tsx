import { createFileRoute, redirect } from '@tanstack/react-router';
import { getAdminAppCapabilities } from '@/policy/admin-app-capabilities.functions';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const capabilities = await getAdminAppCapabilities();
    if (capabilities.canAccessAdminApp) {
      throw redirect({ to: '/dashboard' });
    }
    throw redirect({ to: '/signin' });
  },
});
