import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSend = vi.fn();
const mockEmitCountMetric = vi.fn();

/** Helper: reset modules, re-register resend mock, dynamically import createEmailClient. */
async function importCreateEmailClient() {
  vi.resetModules();
  vi.doMock('resend', () => ({
    Resend: class {
      emails = { send: mockSend };
    },
  }));
  vi.doMock('@/observability/server', () => ({
    METRICS: {
      EMAIL_SENT: 'email.sent',
    },
    emitCountMetric: mockEmitCountMetric,
  }));
  const mod = await import('@/email/resend.server');
  return mod.createEmailClient;
}

describe('createEmailClient', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockEmitCountMetric.mockReset();
  });

  it('sends email with correct params and [DEV] prefix when devPrefix is true', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });
    const createEmailClient = await importCreateEmailClient();
    const client = createEmailClient({
      apiKey: 'test-api-key',
      fromEmail: 'noreply@test.com',
      appName: 'TestApp',
      devPrefix: true,
    });

    const mockReact = createElement('div', null, 'Hello');
    const result = await client.sendEmail({
      to: 'user@example.com',
      subject: 'Welcome',
      react: mockReact,
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@test.com',
        to: 'user@example.com',
        subject: '[DEV] Welcome',
        react: mockReact,
      })
    );
    expect(result).toEqual({ id: 'email-1' });
    expect(mockEmitCountMetric).toHaveBeenCalledWith('email.sent', {
      provider: 'resend',
      result: 'success',
    });
  });

  it('does not prefix subject when devPrefix is false', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-2' }, error: null });
    const createEmailClient = await importCreateEmailClient();
    const client = createEmailClient({
      apiKey: 'test-api-key',
      fromEmail: 'noreply@test.com',
      appName: 'TestApp',
      devPrefix: false,
    });

    await client.sendEmail({
      to: 'user@example.com',
      subject: 'Welcome',
      react: createElement('div'),
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Welcome' })
    );
  });

  it('uses custom devPrefix string', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-3' }, error: null });
    const createEmailClient = await importCreateEmailClient();
    const client = createEmailClient({
      apiKey: 'test-api-key',
      fromEmail: 'noreply@test.com',
      appName: 'TestApp',
      devPrefix: '[STAGING]',
    });

    await client.sendEmail({
      to: 'user@example.com',
      subject: 'Welcome',
      react: createElement('div'),
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: '[STAGING] Welcome' })
    );
  });

  it('throws when Resend API returns an error', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'Rate limit exceeded' },
    });
    const createEmailClient = await importCreateEmailClient();
    const client = createEmailClient({
      apiKey: 'test-api-key',
      fromEmail: 'noreply@test.com',
      appName: 'TestApp',
    });

    await expect(
      client.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        react: createElement('div'),
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining(
        'Failed to send email: Rate limit exceeded'
      ),
    });
    expect(mockEmitCountMetric).not.toHaveBeenCalled();
  });

  it('includes replyTo when replyToEmail is set', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-4' }, error: null });
    const createEmailClient = await importCreateEmailClient();
    const client = createEmailClient({
      apiKey: 'test-api-key',
      fromEmail: 'noreply@test.com',
      replyToEmail: 'reply@test.com',
      appName: 'TestApp',
    });

    await client.sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      react: createElement('div'),
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: 'reply@test.com' })
    );
  });

  it('exposes config on the client', async () => {
    const createEmailClient = await importCreateEmailClient();
    const client = createEmailClient({
      apiKey: 'test-api-key',
      fromEmail: 'noreply@test.com',
      appName: 'TestApp',
    });

    expect(client.config.appName).toBe('TestApp');
    expect(client.config.fromEmail).toBe('noreply@test.com');
  });
});
