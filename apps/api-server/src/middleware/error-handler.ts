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
  _error: Error,
  context: Context<{ Variables: AppVariables }>
): Response {
  return buildErrorResponse(context, 'Internal Server Error', 500);
}
