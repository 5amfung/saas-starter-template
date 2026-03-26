import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  resetPasswordSearchSchema,
  safeRedirectSchema,
  signinSearchSchema,
  signupSchema,
  signupSearchSchema,
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

describe('safeRedirectSchema', () => {
  it('accepts valid relative paths', () => {
    expect(safeRedirectSchema.safeParse('/accept-invite?id=abc').success).toBe(
      true
    );
    expect(safeRedirectSchema.safeParse('/ws').success).toBe(true);
    expect(safeRedirectSchema.safeParse('/some/deep/path').success).toBe(true);
  });

  it('accepts undefined (optional)', () => {
    expect(safeRedirectSchema.safeParse(undefined).success).toBe(true);
  });

  it('rejects absolute URLs', () => {
    expect(safeRedirectSchema.safeParse('https://evil.com').success).toBe(
      false
    );
    expect(safeRedirectSchema.safeParse('http://evil.com').success).toBe(false);
  });

  it('rejects protocol-relative URLs', () => {
    expect(safeRedirectSchema.safeParse('//evil.com').success).toBe(false);
  });

  it('rejects backslash-based redirects', () => {
    expect(safeRedirectSchema.safeParse('/\\evil.com').success).toBe(false);
  });

  it('rejects empty string', () => {
    expect(safeRedirectSchema.safeParse('').success).toBe(false);
  });
});

describe('verifySearchSchema', () => {
  it('accepts optional email', () => {
    expect(verifySearchSchema.safeParse({}).success).toBe(true);
    expect(verifySearchSchema.safeParse({ email: 'a@b.com' }).success).toBe(
      true
    );
  });

  it('accepts optional redirect', () => {
    expect(verifySearchSchema.safeParse({ redirect: '/ws' }).success).toBe(
      true
    );
  });

  it('rejects invalid redirect', () => {
    expect(
      verifySearchSchema.safeParse({ redirect: 'https://evil.com' }).success
    ).toBe(false);
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

  it('accepts optional redirect', () => {
    expect(signinSearchSchema.safeParse({ redirect: '/ws' }).success).toBe(
      true
    );
  });

  it('rejects invalid redirect', () => {
    expect(
      signinSearchSchema.safeParse({ redirect: 'https://evil.com' }).success
    ).toBe(false);
  });
});

describe('signupSearchSchema', () => {
  it('accepts empty object', () => {
    expect(signupSearchSchema.safeParse({}).success).toBe(true);
  });

  it('accepts valid redirect', () => {
    expect(signupSearchSchema.safeParse({ redirect: '/ws' }).success).toBe(
      true
    );
  });

  it('rejects invalid redirect', () => {
    expect(
      signupSearchSchema.safeParse({ redirect: 'https://evil.com' }).success
    ).toBe(false);
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
