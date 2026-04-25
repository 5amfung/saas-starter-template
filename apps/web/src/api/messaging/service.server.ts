import type {
  MessagingHelloRequest,
  MessagingHelloResponse,
} from './hello.schemas';

export function createMessagingHello({
  input,
  workspaceId,
}: {
  input: MessagingHelloRequest;
  workspaceId: string;
}): MessagingHelloResponse {
  return {
    message: `${input.message} ${input.name}`,
    workspace_id: workspaceId,
  };
}
