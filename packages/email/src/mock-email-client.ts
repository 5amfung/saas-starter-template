import type { ReactElement } from 'react';
import type {
  EmailClient,
  EmailConfig,
  SendEmailOptions,
} from './resend.server';

export interface CapturedEmail {
  to: string;
  subject: string;
  react: ReactElement;
  sentAt: Date;
}

export interface MockEmailClient extends EmailClient {
  getEmailsFor: (recipientEmail: string) => Array<CapturedEmail>;
  clearEmailsFor: (recipientEmail: string) => void;
  getAllEmails: () => Array<CapturedEmail>;
  clearEmails: () => void;
}

interface MockEmailClientConfig {
  appName: string;
}

export function createMockEmailClient(
  mockConfig: MockEmailClientConfig
): MockEmailClient {
  const store = new Map<string, Array<CapturedEmail>>();

  const config: Readonly<EmailConfig> = {
    apiKey: 'mock-api-key',
    fromEmail: 'test@example.com',
    appName: mockConfig.appName,
  };

  function addEmail(to: string, subject: string, react: ReactElement): void {
    const entry: CapturedEmail = { to, subject, react, sentAt: new Date() };
    const existing = store.get(to);
    if (existing) {
      existing.push(entry);
    } else {
      store.set(to, [entry]);
    }
  }

  return {
    config,

    // eslint-disable-next-line @typescript-eslint/require-await
    async sendEmail({ to, subject, react }: SendEmailOptions) {
      const recipients = Array.isArray(to) ? to : [to];
      for (const recipient of recipients) {
        addEmail(recipient, subject, react);
      }
      return {
        id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
    },

    getEmailsFor(recipientEmail: string): Array<CapturedEmail> {
      return [...(store.get(recipientEmail) ?? [])];
    },

    clearEmailsFor(recipientEmail: string): void {
      store.delete(recipientEmail);
    },

    getAllEmails(): Array<CapturedEmail> {
      return Array.from(store.values()).flat();
    },

    clearEmails(): void {
      store.clear();
    },
  };
}
