import { captureServerError } from '../lib/observability.js';
import { getRequestId } from '../lib/request-id.js';
import type { AppVariables } from '../lib/request-id.js';

import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

function buildErrorResponse(
  context: Context<{ Variables: AppVariables }>,
  message: string,
  status: ContentfulStatusCode
): Response {
  return context.json(
    {
      error: {
        message,
        requestId: getRequestId(context),
      },
    },
    status
  );
}

export function notFoundHandler(
  context: Context<{ Variables: AppVariables }>
): Response {
  return buildErrorResponse(context, 'Not Found', 404);
}

export function errorHandler(
  error: Error,
  context: Context<{ Variables: AppVariables }>
): Response {
  captureServerError(error, {
    requestId: getRequestId(context),
    route: context.req.path,
  });

  return buildErrorResponse(context, 'Internal Server Error', 500);
}
