import { createMiddleware } from 'hono/factory';

import { REQUEST_ID_HEADER, resolveRequestId } from '../lib/request-id.js';
import type { AppVariables } from '../lib/request-id.js';

export const requestIdMiddleware = createMiddleware<{
  Variables: AppVariables;
}>(async (context, next) => {
  const requestId = resolveRequestId(context.req.raw.headers);

  context.set('requestId', requestId);
  await next();
  context.header(REQUEST_ID_HEADER, requestId);
});
