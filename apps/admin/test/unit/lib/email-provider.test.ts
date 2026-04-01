import { getWebmailLinkForEmail } from '@workspace/components/lib';

describe('getWebmailLinkForEmail', () => {
  it.each([
    ['user@gmail.com', 'Gmail'],
    ['user@googlemail.com', 'Gmail'],
    ['user@outlook.com', 'Outlook'],
    ['user@hotmail.com', 'Outlook'],
    ['user@live.com', 'Outlook'],
    ['user@msn.com', 'Outlook'],
    ['user@yahoo.com', 'Yahoo Mail'],
    ['user@icloud.com', 'iCloud Mail'],
    ['user@me.com', 'iCloud Mail'],
    ['user@mac.com', 'iCloud Mail'],
    ['user@proton.me', 'Proton Mail'],
    ['user@protonmail.com', 'Proton Mail'],
    ['user@aol.com', 'AOL Mail'],
  ])('returns correct provider for %s (%s)', (email, label) => {
    const result = getWebmailLinkForEmail(email);
    expect(result).not.toBeNull();
    expect(result!.label).toBe(label);
    expect(result!.href).toBeTruthy();
  });

  it('returns null for unknown domains', () => {
    expect(getWebmailLinkForEmail('user@company.com')).toBeNull();
  });

  it('returns null for invalid emails', () => {
    expect(getWebmailLinkForEmail('not-an-email')).toBeNull();
    expect(getWebmailLinkForEmail('@no-local.com')).toBeNull();
    expect(getWebmailLinkForEmail('trailing@')).toBeNull();
  });

  it('handles case-insensitive domains', () => {
    expect(getWebmailLinkForEmail('User@GMAIL.COM')?.label).toBe('Gmail');
  });

  it('handles emails with whitespace', () => {
    expect(getWebmailLinkForEmail('  user@gmail.com  ')?.label).toBe('Gmail');
  });
});
