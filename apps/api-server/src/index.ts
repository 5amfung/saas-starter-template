import { serve } from '@hono/node-server';

import { app } from './app.js';
import { getApiName, getPort } from './lib/env.js';

serve(
  {
    fetch: app.fetch,
    port: getPort(),
  },
  (info) => {
    console.info(
      '[%s] listening on http://localhost:%d',
      getApiName(),
      info.port
    );
  }
);
