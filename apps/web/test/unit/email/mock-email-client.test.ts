import { createElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MockEmailClient } from '@/email/mock-email-client';
import { createMockEmailClient } from '@/email/mock-email-client';

describe('createMockEmailClient', () => {
  let client: MockEmailClient;

  beforeEach(() => {
    client = createMockEmailClient({ appName: 'TestApp' });
  });

  it('captures a sent email and retrieves it by recipient', async () => {
    await client.sendEmail({
      to: 'alice@test.com',
      subject: 'Hello',
      react: createElement('div', null, 'test'),
    });

    const emails = client.getEmailsFor('alice@test.com');
    expect(emails).toHaveLength(1);
    expect(emails[0]?.to).toBe('alice@test.com');
    expect(emails[0]?.subject).toBe('Hello');
    expect(emails[0]?.sentAt).toBeInstanceOf(Date);
  });

  it('returns empty array for unknown recipient', () => {
    const emails = client.getEmailsFor('nobody@test.com');
    expect(emails).toEqual([]);
  });

  it('isolates emails by recipient', async () => {
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

    expect(client.getEmailsFor('alice@test.com')).toHaveLength(1);
    expect(client.getEmailsFor('bob@test.com')).toHaveLength(1);
    expect(client.getEmailsFor('alice@test.com')[0]?.subject).toBe('For Alice');
  });

  it('clearEmailsFor removes only that recipient', async () => {
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
  });

  it('clearEmails removes all emails', async () => {
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
  });

  it('getAllEmails returns all captured emails', async () => {
    await client.sendEmail({
      to: 'alice@test.com',
      subject: 'One',
      react: createElement('div', null, '1'),
    });
    await client.sendEmail({
      to: 'bob@test.com',
      subject: 'Two',
      react: createElement('div', null, '2'),
    });

    expect(client.getAllEmails()).toHaveLength(2);
  });

  it('orders emails by sentAt', async () => {
    await client.sendEmail({
      to: 'alice@test.com',
      subject: 'First',
      react: createElement('div', null, '1'),
    });
    await client.sendEmail({
      to: 'alice@test.com',
      subject: 'Second',
      react: createElement('div', null, '2'),
    });

    const emails = client.getEmailsFor('alice@test.com');
    expect(emails).toHaveLength(2);
    expect(emails[0]?.subject).toBe('First');
    expect(emails[1]?.subject).toBe('Second');
    expect(emails[0]?.sentAt.getTime()).toBeLessThanOrEqual(
      emails[1]?.sentAt.getTime()
    );
  });

  it('handles array of recipients', async () => {
    await client.sendEmail({
      to: ['alice@test.com', 'bob@test.com'],
      subject: 'Group',
      react: createElement('div', null, 'group'),
    });

    expect(client.getEmailsFor('alice@test.com')).toHaveLength(1);
    expect(client.getEmailsFor('bob@test.com')).toHaveLength(1);
  });

  it('exposes config with appName', () => {
    expect(client.config.appName).toBe('TestApp');
  });

  it('returns an object with id from sendEmail', async () => {
    const result = await client.sendEmail({
      to: 'alice@test.com',
      subject: 'Hello',
      react: createElement('div', null, 'test'),
    });

    expect(result).toHaveProperty('id');
    expect(typeof result?.id).toBe('string');
  });
});
