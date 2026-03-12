import { adminUserFormSchema } from './schemas';

describe('adminUserFormSchema', () => {
  const validData = {
    name: 'Jane',
    email: 'jane@example.com',
    emailVerified: true,
    image: '',
    role: 'admin',
    banned: false,
    banReason: '',
    banExpires: '',
  };

  it('accepts valid admin user data', () => {
    expect(adminUserFormSchema.safeParse(validData).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(
      adminUserFormSchema.safeParse({ ...validData, name: '' }).success,
    ).toBe(false);
  });

  it('rejects invalid email', () => {
    expect(
      adminUserFormSchema.safeParse({ ...validData, email: 'nope' }).success,
    ).toBe(false);
  });

  it('rejects empty role', () => {
    expect(
      adminUserFormSchema.safeParse({ ...validData, role: '' }).success,
    ).toBe(false);
  });

  it('trims name whitespace', () => {
    const result = adminUserFormSchema.safeParse({
      ...validData,
      name: '  Jane  ',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Jane');
  });
});
