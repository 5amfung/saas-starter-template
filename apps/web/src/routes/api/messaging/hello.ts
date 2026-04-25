import { createFileRoute } from '@tanstack/react-router';
import type { JsonBodyContext } from '@/api/middleware/json-body.server';
import type { WorkspaceApiKeyContext } from '@/api/middleware/workspace-api-key.server';
import type { MessagingHelloRequest } from '@/api/messaging/hello.schemas';

import { validateJsonBody } from '@/api/middleware/json-body.server';
import { verifyWorkspaceApiKeyMiddleware } from '@/api/middleware/workspace-api-key.server';
import { messagingHelloRequestSchema } from '@/api/messaging/hello.schemas';
import { createMessagingHello } from '@/api/messaging/service.server';
import { requestLogger } from '@/observability/server';

type MessagingHelloRouteContext = JsonBodyContext<MessagingHelloRequest> &
  WorkspaceApiKeyContext;

type MessagingHelloRouteArgs = {
  context: MessagingHelloRouteContext;
  request: Request;
};

export const Route = createFileRoute('/api/messaging/hello')({
  server: {
    middleware: [
      requestLogger,
      verifyWorkspaceApiKeyMiddleware,
      validateJsonBody(messagingHelloRequestSchema),
    ],
    handlers: {
      POST: ({ context }: MessagingHelloRouteArgs) => {
        const response = createMessagingHello({
          input: context.jsonBody,
          workspaceId: context.workspaceApiKey.workspaceId,
        });

        return Response.json(response);
      },
    },
  },
});
