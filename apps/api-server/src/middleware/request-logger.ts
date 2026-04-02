import { createMiddleware } from 'hono/factory';

import { isTestEnv } from '../lib/env.js';
import { getRequestId } from '../lib/request-id.js';
import type { AppVariables } from '../lib/request-id.js';

export const requestLoggerMiddleware = createMiddleware<{
  Variables: AppVariables;
}>(async (context, next) => {
  const startedAt = Date.now();

  await next();

  if (isTestEnv()) {
    return;
  }

  console.info(
    '%s %s %d %dms %s',
    context.req.method,
    context.req.path,
    context.res.status,
    Date.now() - startedAt,
    getRequestId(context)
  );
});
