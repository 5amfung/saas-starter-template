import type { Context } from 'hono';

export interface AppVariables {
  requestId: string;
}

export const REQUEST_ID_HEADER = 'x-request-id';

export function resolveRequestId(headers: Headers): string {
  const forwardedRequestId = headers.get(REQUEST_ID_HEADER)?.trim();

  return forwardedRequestId || crypto.randomUUID();
}

export function getRequestId(
  context: Context<{ Variables: AppVariables }>
): string {
  return context.get('requestId');
}
