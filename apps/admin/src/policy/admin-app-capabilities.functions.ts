import { createServerFn } from '@tanstack/react-start';
import { getCurrentAdminAppCapabilities } from './admin-app-capabilities.server';

export const getAdminAppCapabilities = createServerFn().handler(async () => {
  return getCurrentAdminAppCapabilities();
});
