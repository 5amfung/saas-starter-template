import { createFileRoute } from '@tanstack/react-router';
import { verifyWorkspaceApiKey } from '@/api/api-key-auth.server';

function jsonError(message: string, status: number): Response {
  return Response.json(
    { error: message },
    {
      status,
    }
  );
}

export const Route = createFileRoute('/api/hello')({
  server: {
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
            case 'forbidden':
              return jsonError(
                'API key is not authorized for this workspace',
                403
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
