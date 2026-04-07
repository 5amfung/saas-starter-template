import { createServerFn } from '@tanstack/react-start';
import { getCurrentWebAppEntry } from './web-app-entry.server';

export const getWebAppEntry = createServerFn().handler(async () => {
  return getCurrentWebAppEntry();
});
