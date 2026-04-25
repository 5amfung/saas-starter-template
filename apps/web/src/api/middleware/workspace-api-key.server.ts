import { createMiddleware } from '@tanstack/react-start';
import { jsonError } from '@/api/response.server';
import { verifyWorkspaceApiKey } from '@/api/api-key-auth.server';

export type WorkspaceApiKeyContext = {
  workspaceApiKey: {
    keyId: string;
    workspaceId: string;
  };
};

function verificationErrorResponse(
  verification: Exclude<
    Awaited<ReturnType<typeof verifyWorkspaceApiKey>>,
    { ok: true }
  >
): Response {
  switch (verification.reason) {
    case 'missing-workspace':
      return jsonError('Missing required header: x-api-workspace-id', 400);
    case 'missing-key':
      return jsonError('Missing API key', 401);
    case 'forbidden':
      return jsonError('API key is not authorized for this workspace', 403);
    case 'rate-limited':
      return jsonError(
        'Rate limit exceeded.',
        429,
        verification.retryAfterSeconds === null
          ? undefined
          : {
              'Retry-After': String(verification.retryAfterSeconds),
            }
      );
    case 'invalid-key':
    default:
      return jsonError('Invalid API key', 401);
  }
}

export const workspaceApiKeyMiddleware = createMiddleware().server(
  async ({ request, next }) => {
    const verification = await verifyWorkspaceApiKey({
      apiKey: request.headers.get('x-api-key'),
      workspaceId: request.headers.get('x-api-workspace-id'),
    });

    if (!verification.ok) {
      return verificationErrorResponse(verification);
    }

    return next({
      context: {
        workspaceApiKey: {
          keyId: verification.keyId,
          workspaceId: verification.workspaceId,
        },
      },
    });
  }
);
