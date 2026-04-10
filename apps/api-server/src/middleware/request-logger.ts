import { createMiddleware } from 'hono/factory';

import { isTestEnv } from '../lib/env.js';
import { getRequestId } from '../lib/request-id.js';
import type { AppVariables } from '../lib/request-id.js';

export const requestLoggerMiddleware = createMiddleware<{
  Variables: AppVariables;
}>(async (context, next) => {
  const startedAt = Date.now();
  const requestId = getRequestId(context);
  const durationMs = () => Date.now() - startedAt;

  await next();

  if (isTestEnv()) {
    return;
  }

  console.info(
    JSON.stringify({
      level: 'info',
      message: 'request completed',
      service: 'api-server',
      requestId,
      route: context.req.path,
      operation: `${context.req.method} ${context.req.path}`,
      statusCode: context.res.status,
      durationMs: durationMs(),
    })
  );
});
