import { z } from 'zod';

export const messagingHelloRequestSchema = z.object({
  name: z.string().trim().min(1),
  message: z.string().trim().min(1),
});

export type MessagingHelloRequest = z.infer<typeof messagingHelloRequestSchema>;

export type MessagingHelloResponse = {
  message: string;
  workspace_id: string;
};
