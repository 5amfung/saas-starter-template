import { createElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createMockEmailClient } from '@workspace/email';
import type { MockEmailClient } from '@workspace/email';

describe('Mock email client integration', () => {
  let client: MockEmailClient;

  beforeEach(() => {
    client = createMockEmailClient({ appName: 'TestApp' });
  });

  it('captures verification email with correct URL and subject', async () => {
    const verificationUrl =
      'http://localhost:3000/api/auth/verify-email?token=abc123&callbackURL=/ws';

    await client.sendEmail({
      to: 'user@test.com',
      subject: 'Verify your email address',
      react: createElement('div', { verificationUrl }, 'Verify'),
    });

    const emails = client.getEmailsFor('user@test.com');
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toBe('Verify your email address');
    expect(emails[0].react.props.verificationUrl).toBe(verificationUrl);
  });

  it('verification URL contains token and callbackURL params', async () => {
    const verificationUrl =
      'http://localhost:3000/api/auth/verify-email?token=test-token-xyz&callbackURL=%2Fws';

    await client.sendEmail({
      to: 'user@test.com',
      subject: 'Verify your email address',
      react: createElement('div', { verificationUrl }, 'Verify'),
    });

    const emails = client.getEmailsFor('user@test.com');
    const url = new URL(emails[0].react.props.verificationUrl as string);
    expect(url.searchParams.get('token')).toBe('test-token-xyz');
    expect(url.searchParams.get('callbackURL')).toBe('/ws');
  });

  it('isolates emails between different recipients', async () => {
    await client.sendEmail({
      to: 'alice@test.com',
      subject: 'For Alice',
      react: createElement('div', null, 'alice'),
    });
    await client.sendEmail({
      to: 'bob@test.com',
      subject: 'For Bob',
      react: createElement('div', null, 'bob'),
    });

    const aliceEmails = client.getEmailsFor('alice@test.com');
    const bobEmails = client.getEmailsFor('bob@test.com');

    expect(aliceEmails).toHaveLength(1);
    expect(bobEmails).toHaveLength(1);
    expect(aliceEmails[0].subject).toBe('For Alice');
    expect(bobEmails[0].subject).toBe('For Bob');
  });

  it('clearEmailsFor removes only that recipient, others intact', async () => {
    await client.sendEmail({
      to: 'alice@test.com',
      subject: 'For Alice',
      react: createElement('div', null, 'alice'),
    });
    await client.sendEmail({
      to: 'bob@test.com',
      subject: 'For Bob',
      react: createElement('div', null, 'bob'),
    });

    client.clearEmailsFor('alice@test.com');

    expect(client.getEmailsFor('alice@test.com')).toEqual([]);
    expect(client.getEmailsFor('bob@test.com')).toHaveLength(1);
    expect(client.getEmailsFor('bob@test.com')[0].subject).toBe('For Bob');
  });

  it('clearEmails removes entire store (Vitest-safe, separate process)', async () => {
    await client.sendEmail({
      to: 'alice@test.com',
      subject: 'For Alice',
      react: createElement('div', null, 'alice'),
    });
    await client.sendEmail({
      to: 'bob@test.com',
      subject: 'For Bob',
      react: createElement('div', null, 'bob'),
    });

    client.clearEmails();

    expect(client.getAllEmails()).toEqual([]);
    expect(client.getEmailsFor('alice@test.com')).toEqual([]);
    expect(client.getEmailsFor('bob@test.com')).toEqual([]);
  });
});
