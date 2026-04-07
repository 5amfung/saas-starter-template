import { createServerFn } from '@tanstack/react-start';
import {
  getCurrentAdminAppCapabilities,
  getCurrentAdminAppEntry,
} from './admin-app-capabilities.server';

export const getAdminAppEntry = createServerFn().handler(async () => {
  return getCurrentAdminAppEntry();
});

export const getAdminAppCapabilities = createServerFn().handler(async () => {
  return getCurrentAdminAppCapabilities();
});
