import { createElement } from 'react';
import { render } from '@react-email/render';
import { EmailSecurityNotice } from '@/email/templates/email-security-notice';

describe('EmailSecurityNotice', () => {
  it('renders with full context (IP, city, country)', async () => {
    const html = await render(
      createElement(EmailSecurityNotice, {
        requestContext: {
          requestedAtUtc: '13 March 2025, 12:00 UTC',
          ip: '1.2.3.4',
          city: 'San Francisco',
          country: 'US',
        },
      })
    );
    expect(html).toContain('1.2.3.4');
    expect(html).toContain('San Francisco');
    expect(html).toContain('US');
    expect(html).toContain('13 March 2025');
  });

  it('renders with IP only (no city/country)', async () => {
    const html = await render(
      createElement(EmailSecurityNotice, {
        requestContext: {
          requestedAtUtc: '13 March 2025, 12:00 UTC',
          ip: '1.2.3.4',
        },
      })
    );
    expect(html).toContain('1.2.3.4');
    expect(html).toContain('13 March 2025');
  });

  it('renders with timestamp only (no IP)', async () => {
    const html = await render(
      createElement(EmailSecurityNotice, {
        requestContext: {
          requestedAtUtc: '13 March 2025, 12:00 UTC',
        },
      })
    );
    expect(html).toContain('13 March 2025');
    expect(html).toContain('Didn&#x27;t request this?');
  });

  it('renders reassurance text', async () => {
    const html = await render(
      createElement(EmailSecurityNotice, {
        requestContext: {
          requestedAtUtc: '13 March 2025, 12:00 UTC',
        },
      })
    );
    expect(html).toContain('safely ignore');
  });
});
