import { createFileRoute } from '@tanstack/react-router';
import { requestLogger } from '@workspace/logging';
import { verifyWorkspaceApiKey } from '@/api/api-key-auth.server';

function jsonError(
  message: string,
  status: number,
  headers?: HeadersInit
): Response {
  return Response.json(
    { error: message },
    {
      headers,
      status,
    }
  );
}

export const Route = createFileRoute('/api/hello')({
  server: {
    middleware: [requestLogger],
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const verification = await verifyWorkspaceApiKey({
          apiKey: request.headers.get('x-api-key'),
          workspaceId: request.headers.get('x-api-workspace-id'),
        });

        if (!verification.ok) {
          switch (verification.reason) {
            case 'missing-workspace':
              return jsonError(
                'Missing required header: x-api-workspace-id',
                400
              );
            case 'missing-key':
              return jsonError('Missing API key', 401);
            case 'forbidden':
              return jsonError(
                'API key is not authorized for this workspace',
                403
              );
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

        return Response.json({ message: 'hello' });
      },
    },
  },
});
