import { createFileRoute, redirect } from '@tanstack/react-router';
import { getAdminAppCapabilities } from '@/policy/admin-app-capabilities.functions';
import { getDefaultAdminRoute } from '@/policy/admin-app-route-access';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const capabilities = await getAdminAppCapabilities();
    const defaultRoute = getDefaultAdminRoute(capabilities);
    if (capabilities.canAccessAdminApp && defaultRoute) {
      throw redirect({ to: defaultRoute });
    }
    throw redirect({ to: '/signin' });
  },
});
