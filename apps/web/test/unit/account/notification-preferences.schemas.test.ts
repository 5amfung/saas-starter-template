import {
  notificationPreferencesSchema,
  updateNotificationPreferencesInput,
} from '@/account/notification-preferences.schemas';

describe('updateNotificationPreferencesInput', () => {
  it('accepts valid input with marketingEmails boolean', () => {
    const result = updateNotificationPreferencesInput.safeParse({
      marketingEmails: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (all fields optional)', () => {
    const result = updateNotificationPreferencesInput.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects unknown fields (strict mode)', () => {
    const result = updateNotificationPreferencesInput.safeParse({
      marketingEmails: true,
      unknownField: 'value',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-boolean marketingEmails', () => {
    const result = updateNotificationPreferencesInput.safeParse({
      marketingEmails: 'yes',
    });
    expect(result.success).toBe(false);
  });
});

describe('notificationPreferencesSchema', () => {
  it('accepts valid preferences', () => {
    const result = notificationPreferencesSchema.safeParse({
      emailUpdates: true,
      marketingEmails: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects emailUpdates as false (must be literal true)', () => {
    const result = notificationPreferencesSchema.safeParse({
      emailUpdates: false,
      marketingEmails: false,
    });
    expect(result.success).toBe(false);
  });
});
