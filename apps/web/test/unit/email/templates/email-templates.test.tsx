import { createElement } from 'react';
import { render } from '@react-email/render';
import { ChangeEmailApprovalEmail } from '@/email/templates/change-email-approval-email';
import { EmailVerificationEmail } from '@/email/templates/email-verification-email';
import { ResetPasswordEmail } from '@/email/templates/reset-password-email';
import { WorkspaceInvitationEmail } from '@/email/templates/workspace-invitation-email';

const baseRequestContext = {
  requestedAtUtc: '13 March 2025, 12:00 UTC',
  ip: '1.2.3.4',
  city: 'San Francisco',
  country: 'US',
};

describe('ChangeEmailApprovalEmail', () => {
  it('renders with required props', async () => {
    const html = await render(
      createElement(ChangeEmailApprovalEmail, {
        appName: 'TestApp',
        newEmail: 'new@example.com',
        approvalUrl: 'https://example.com/approve?token=abc',
        requestContext: baseRequestContext,
      })
    );
    expect(html).toContain('new@example.com');
    expect(html).toContain('Approve change');
    expect(html).toContain('TestApp');
    expect(html).toContain('https://example.com/approve?token=abc');
  });
});

describe('EmailVerificationEmail', () => {
  it('renders with required props', async () => {
    const html = await render(
      createElement(EmailVerificationEmail, {
        appName: 'TestApp',
        verificationUrl: 'https://example.com/verify?token=abc',
        requestContext: baseRequestContext,
      })
    );
    expect(html).toContain('Verify email');
    expect(html).toContain('TestApp');
    expect(html).toContain('https://example.com/verify?token=abc');
  });
});

describe('ResetPasswordEmail', () => {
  it('renders with required props', async () => {
    const html = await render(
      createElement(ResetPasswordEmail, {
        appName: 'TestApp',
        resetUrl: 'https://example.com/reset?token=abc',
        requestContext: baseRequestContext,
      })
    );
    expect(html).toContain('Reset password');
    expect(html).toContain('TestApp');
    expect(html).toContain('https://example.com/reset?token=abc');
  });
});

describe('WorkspaceInvitationEmail', () => {
  it('renders with required props', async () => {
    const html = await render(
      createElement(WorkspaceInvitationEmail, {
        appName: 'TestApp',
        workspaceName: 'Acme Corp',
        inviterEmail: 'owner@example.com',
        invitationUrl: 'https://example.com/invite?token=abc',
      })
    );
    expect(html).toContain('Acme Corp');
    expect(html).toContain('owner@example.com');
    expect(html).toContain('Accept invitation');
    expect(html).toContain('TestApp');
  });

  it('does not include security notice', async () => {
    const html = await render(
      createElement(WorkspaceInvitationEmail, {
        appName: 'TestApp',
        workspaceName: 'Acme Corp',
        inviterEmail: 'owner@example.com',
        invitationUrl: 'https://example.com/invite?token=abc',
      })
    );
    expect(html).not.toContain("Didn't request this?");
  });
});
