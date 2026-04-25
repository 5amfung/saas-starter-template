export {
  createEmailClient,
  type EmailConfig,
  type EmailClient,
  type SendEmailOptions,
} from './resend.server';
export {
  buildEmailRequestContext,
  type EmailRequestContext,
} from './request-context';
export {
  createMockEmailClient,
  type CapturedEmail,
  type MockEmailClient,
} from './mock-email-client';
