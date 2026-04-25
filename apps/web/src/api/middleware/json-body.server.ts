import { createMiddleware } from '@tanstack/react-start';
import type { ZodType } from 'zod';

import { jsonError } from '@/api/response.server';

export type JsonBodyContext<T> = {
  jsonBody: T;
};

type ParseJsonBodyResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      message: string;
      status: number;
    };

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<ParseJsonBodyResult<T>> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return {
      ok: false,
      message: 'Invalid JSON payload',
      status: 400,
    };
  }

  const result = schema.safeParse(payload);

  if (!result.success) {
    return {
      ok: false,
      message: 'Invalid request payload',
      status: 400,
    };
  }

  return {
    ok: true,
    data: result.data,
  };
}

export function validateJsonBody<T>(schema: ZodType<T>) {
  return createMiddleware().server(async ({ request, next }) => {
    const parsedBody = await parseJsonBody(request, schema);

    if (!parsedBody.ok) {
      return jsonError(parsedBody.message, parsedBody.status);
    }

    return next({
      context: {
        jsonBody: parsedBody.data,
      },
    });
  });
}
