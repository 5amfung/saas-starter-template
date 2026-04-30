import { Resend } from 'resend';
import type { ReactElement } from 'react';
import { METRICS, emitCountMetric } from '@/observability/server';

export interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  replyToEmail?: string;
  appName: string;
  devPrefix?: boolean | string;
}

export interface SendEmailOptions {
  to: string | Array<string>;
  subject: string;
  react: ReactElement;
}

export interface EmailClient {
  sendEmail: (options: SendEmailOptions) => Promise<{ id: string } | null>;
  readonly config: Readonly<EmailConfig>;
}

export function createEmailClient(config: EmailConfig): EmailClient {
  const resend = new Resend(config.apiKey);

  function prefixSubject(subject: string): string {
    if (!config.devPrefix) return subject;
    const prefix =
      typeof config.devPrefix === 'string' ? config.devPrefix : '[DEV]';
    return `${prefix} ${subject}`;
  }

  return {
    config,
    async sendEmail({ to, subject, react }: SendEmailOptions) {
      const { data, error } = await resend.emails.send({
        from: config.fromEmail,
        to,
        subject: prefixSubject(subject),
        react,
        ...(config.replyToEmail && { replyTo: config.replyToEmail }),
      });

      if (error) {
        throw new Error(`Failed to send email: ${error.message}`);
      }

      emitCountMetric(METRICS.EMAIL_SENT, {
        provider: 'resend',
        result: 'success',
      });

      return data;
    },
  };
}
