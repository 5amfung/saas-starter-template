import { getRequestId } from '../lib/request-id.js';
import type { AppVariables } from '../lib/request-id.js';

import type { Hono } from 'hono';

export function registerHelloRoute(
  app: Hono<{ Variables: AppVariables }>
): void {
  app.get('/hello', (context) => {
    return context.json({
      message: 'Hello from the API',
      requestId: getRequestId(context),
    });
  });
}
