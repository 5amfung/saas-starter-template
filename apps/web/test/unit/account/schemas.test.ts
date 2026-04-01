import {
  accountProfileSchema,
  changeEmailSchema,
  changePasswordSchema,
} from '@workspace/components/account';

describe('accountProfileSchema', () => {
  it('accepts valid name', () => {
    expect(accountProfileSchema.safeParse({ name: 'Alice' }).success).toBe(
      true
    );
  });

  it('trims whitespace', () => {
    const result = accountProfileSchema.safeParse({ name: '  Alice  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Alice');
  });

  it('rejects empty name', () => {
    expect(accountProfileSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejects whitespace-only name', () => {
    expect(accountProfileSchema.safeParse({ name: '   ' }).success).toBe(false);
  });
});

describe('changeEmailSchema', () => {
  it('accepts valid email', () => {
    expect(changeEmailSchema.safeParse({ newEmail: 'a@b.com' }).success).toBe(
      true
    );
  });

  it('rejects invalid email', () => {
    expect(changeEmailSchema.safeParse({ newEmail: 'not-email' }).success).toBe(
      false
    );
  });
});

describe('changePasswordSchema', () => {
  it('accepts matching passwords meeting min length', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldpass',
      newPassword: 'newpass88',
      confirmPassword: 'newpass88',
    });
    expect(result.success).toBe(true);
  });

  it('rejects short new password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'old',
      newPassword: 'short',
      confirmPassword: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects mismatched passwords', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldpass',
      newPassword: 'newpass88',
      confirmPassword: 'different',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty current password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: '',
      newPassword: 'newpass88',
      confirmPassword: 'newpass88',
    });
    expect(result.success).toBe(false);
  });
});
