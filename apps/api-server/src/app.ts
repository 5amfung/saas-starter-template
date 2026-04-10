import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';

import { getCorsOrigin } from './lib/env.js';
import { initObservability } from './lib/observability.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { requestLoggerMiddleware } from './middleware/request-logger.js';
import { registerHelloRoute } from './routes/hello.js';
import type { AppVariables } from './lib/request-id.js';

export const app = new Hono<{ Variables: AppVariables }>();

initObservability({
  app: 'api-server',
  appEnv:
    process.env.APP_ENV === 'staging' || process.env.APP_ENV === 'production'
      ? process.env.APP_ENV
      : 'local',
  dsn: process.env.SENTRY_DSN,
  release: process.env.APP_RELEASE,
});

app.use('*', requestIdMiddleware);
app.use('*', requestLoggerMiddleware);
app.use(
  '*',
  cors({
    origin: getCorsOrigin(),
    allowHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);
app.use('*', secureHeaders());
app.use('*', bodyLimit({ maxSize: 1024 * 1024 }));

registerHelloRoute(app);

app.notFound(notFoundHandler);
app.onError(errorHandler);
