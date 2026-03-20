import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  resetPasswordSearchSchema,
  signinSearchSchema,
  signupSchema,
  verifySearchSchema,
} from '../../src/schemas';

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    expect(
      loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success
    ).toBe(true);
  });

  it('rejects invalid email', () => {
    expect(loginSchema.safeParse({ email: 'bad', password: 'x' }).success).toBe(
      false
    );
  });

  it('rejects empty password', () => {
    expect(
      loginSchema.safeParse({ email: 'a@b.com', password: '' }).success
    ).toBe(false);
  });
});

describe('signupSchema', () => {
  it('accepts valid signup with matching passwords', () => {
    expect(
      signupSchema.safeParse({
        email: 'a@b.com',
        password: 'password8',
        confirmPassword: 'password8',
      }).success
    ).toBe(true);
  });

  it('rejects password under 8 chars', () => {
    expect(
      signupSchema.safeParse({
        email: 'a@b.com',
        password: 'short',
        confirmPassword: 'short',
      }).success
    ).toBe(false);
  });

  it('rejects mismatched passwords', () => {
    expect(
      signupSchema.safeParse({
        email: 'a@b.com',
        password: 'password8',
        confirmPassword: 'different',
      }).success
    ).toBe(false);
  });
});

describe('verifySearchSchema', () => {
  it('accepts optional email', () => {
    expect(verifySearchSchema.safeParse({}).success).toBe(true);
    expect(verifySearchSchema.safeParse({ email: 'a@b.com' }).success).toBe(
      true
    );
  });
});

describe('forgotPasswordSchema', () => {
  it('requires valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(
      true
    );
    expect(forgotPasswordSchema.safeParse({ email: 'bad' }).success).toBe(
      false
    );
  });
});

describe('resetPasswordSchema', () => {
  it('accepts matching passwords meeting min length', () => {
    expect(
      resetPasswordSchema.safeParse({
        newPassword: 'password8',
        confirmPassword: 'password8',
      }).success
    ).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    expect(
      resetPasswordSchema.safeParse({
        newPassword: 'password8',
        confirmPassword: 'different',
      }).success
    ).toBe(false);
  });
});

describe('signinSearchSchema', () => {
  it('accepts optional error', () => {
    expect(signinSearchSchema.safeParse({}).success).toBe(true);
    expect(signinSearchSchema.safeParse({ error: 'oops' }).success).toBe(true);
  });
});

describe('resetPasswordSearchSchema', () => {
  it('accepts optional token and error', () => {
    expect(resetPasswordSearchSchema.safeParse({}).success).toBe(true);
    expect(
      resetPasswordSearchSchema.safeParse({ token: 'abc', error: 'x' }).success
    ).toBe(true);
  });
});
