import type { ReactElement } from 'react';
import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const APP_NAME = process.env.VITE_APP_NAME ?? 'App';

function ensureEmailConfig(): { apiKey: string; from: string } {
  if (!RESEND_API_KEY || RESEND_API_KEY.trim() === '') {
    throw new Error('RESEND_API_KEY is required for sending emails.');
  }
  if (!RESEND_FROM_EMAIL || RESEND_FROM_EMAIL.trim() === '') {
    throw new Error('RESEND_FROM_EMAIL is required for sending emails.');
  }
  return { apiKey: RESEND_API_KEY, from: RESEND_FROM_EMAIL };
}

function prefixSubject(subject: string): string {
  if (process.env.NODE_ENV === 'production') {
    return subject;
  }
  return `[DEV] ${subject}`;
}

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const { apiKey } = ensureEmailConfig();
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export interface SendEmailOptions {
  to: string | Array<string>;
  subject: string;
  react: ReactElement;
}

export async function sendEmail({ to, subject, react }: SendEmailOptions) {
  const { from } = ensureEmailConfig();
  const prefixedSubject = prefixSubject(subject);
  const resend = getResendClient();

  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: prefixedSubject,
    react,
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return data;
}

export { APP_NAME };
