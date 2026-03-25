# Accept Invite Redirect Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve invitation context through the auth flow so new users can sign up and be redirected back to accept their workspace invitation.

**Architecture:** Add a `redirect` search parameter threaded through all auth pages (sign-in, sign-up, verify, Google OAuth). When `/accept-invite` detects no session, it redirects to `/signup?redirect=/accept-invite?id=xyz`. All auth forms use this as `callbackURL` instead of hardcoded `'/ws'`.

**Tech Stack:** TanStack Router (search params, `createFileRoute`), Zod v4 (validation), Better Auth (`callbackURL`), Vitest + Testing Library (tests)

**Spec:** `docs/superpowers/specs/2026-03-24-accept-invite-redirect-flow-design.md`

---

## File Structure

| File                                                                | Action | Responsibility                                                                                        |
| ------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| `packages/auth/src/schemas.ts`                                      | Modify | Add `safeRedirectSchema`, update `signinSearchSchema`, `verifySearchSchema`, add `signupSearchSchema` |
| `packages/auth/test/unit/schemas.test.ts`                           | Modify | Add tests for `safeRedirectSchema`, `signupSearchSchema`, updated schemas                             |
| `apps/web/src/components/auth/google-sign-in-button.tsx`            | Modify | Accept `callbackURL` prop                                                                             |
| `apps/web/test/unit/components/auth/google-sign-in-button.test.tsx` | Modify | Test custom `callbackURL`                                                                             |
| `apps/web/test/mocks/google-sign-in-button.ts`                      | Modify | Accept and forward `callbackURL` prop in mock                                                         |
| `apps/web/src/components/auth/signin-form.tsx`                      | Modify | Accept `redirect` prop, use as `callbackURL`, thread to links                                         |
| `apps/web/test/unit/components/auth/signin-form.test.tsx`           | Modify | Test redirect prop behavior                                                                           |
| `apps/web/src/components/auth/signup-form.tsx`                      | Modify | Accept `redirect` prop, use as `callbackURL`, thread to links and verify nav                          |
| `apps/web/test/unit/components/auth/signup-form.test.tsx`           | Modify | Test redirect prop behavior                                                                           |
| `apps/web/src/routes/_auth/signin.tsx`                              | Modify | Read `redirect` from search, pass to `SigninForm`                                                     |
| `apps/web/src/routes/_auth/signup.tsx`                              | Modify | Add `validateSearch`, read `redirect`, pass to `SignupForm`                                           |
| `apps/web/src/routes/_auth/verify.tsx`                              | Modify | Read `redirect` from search, use as `callbackURL`                                                     |
| `apps/web/src/routes/accept-invite.tsx`                             | Modify | Redirect unauthenticated users to `/signup` with `redirect` param                                     |

---

### Task 1: Add `safeRedirectSchema` and Update Auth Schemas

**Files:**

- Modify: `packages/auth/src/schemas.ts`
- Modify: `packages/auth/test/unit/schemas.test.ts`

- [ ] **Step 1: Write failing tests for `safeRedirectSchema` and updated schemas**

Add to `packages/auth/test/unit/schemas.test.ts`:

```ts
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

// ... existing tests ...

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

describe('signupSearchSchema', () => {
  it('accepts empty object', () => {
    expect(signupSearchSchema.safeParse({}).success).toBe(true);
  });

  it('accepts valid redirect', () => {
    expect(
      signupSearchSchema.safeParse({ redirect: '/accept-invite?id=abc' })
        .success
    ).toBe(true);
  });

  it('rejects invalid redirect', () => {
    expect(
      signupSearchSchema.safeParse({ redirect: 'https://evil.com' }).success
    ).toBe(false);
  });
});
```

Also update the existing `signinSearchSchema` and `verifySearchSchema` test blocks to include redirect:

```ts
describe('signinSearchSchema', () => {
  it('accepts optional error', () => {
    expect(signinSearchSchema.safeParse({}).success).toBe(true);
    expect(signinSearchSchema.safeParse({ error: 'oops' }).success).toBe(true);
  });

  it('accepts optional redirect', () => {
    expect(
      signinSearchSchema.safeParse({ redirect: '/accept-invite?id=abc' })
        .success
    ).toBe(true);
  });

  it('rejects invalid redirect', () => {
    expect(
      signinSearchSchema.safeParse({ redirect: 'https://evil.com' }).success
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

  it('accepts optional redirect', () => {
    expect(verifySearchSchema.safeParse({ redirect: '/ws' }).success).toBe(
      true
    );
  });

  it('rejects invalid redirect', () => {
    expect(
      verifySearchSchema.safeParse({ redirect: '//evil.com' }).success
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @workspace/auth test test/unit/schemas.test.ts`
Expected: FAIL — `safeRedirectSchema` and `signupSearchSchema` not exported, redirect field not recognized.

- [ ] **Step 3: Implement schema changes**

Update `packages/auth/src/schemas.ts`:

```ts
import * as z from 'zod';

// ... existing schemas (loginSchema, signupSchema, etc.) ...

export const safeRedirectSchema = z
  .string()
  .min(1)
  .refine(
    (val) => val.startsWith('/') && !val.startsWith('//') && !val.includes('\\')
  )
  .optional();

export const verifySearchSchema = z.object({
  email: z.email({ error: 'Invalid email.' }).optional(),
  redirect: safeRedirectSchema,
});

// ... existing forgotPasswordSchema, resetPasswordSchema ...

export const signinSearchSchema = z.object({
  error: z.string().optional(),
  redirect: safeRedirectSchema,
});

export const signupSearchSchema = z.object({
  redirect: safeRedirectSchema,
});

// ... existing resetPasswordSearchSchema ...
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @workspace/auth test test/unit/schemas.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add packages/auth/src/schemas.ts packages/auth/test/unit/schemas.test.ts
git commit -m "feat(auth): add safeRedirectSchema and signupSearchSchema for invite redirect flow"
```

---

### Task 2: Update `GoogleSignInButton` to Accept `callbackURL` Prop

**Files:**

- Modify: `apps/web/src/components/auth/google-sign-in-button.tsx`
- Modify: `apps/web/test/unit/components/auth/google-sign-in-button.test.tsx`
- Modify: `apps/web/test/mocks/google-sign-in-button.ts`

- [ ] **Step 1: Write failing tests**

Add to `apps/web/test/unit/components/auth/google-sign-in-button.test.tsx`:

```ts
it('uses default callbackURL /ws when no prop provided', async () => {
  const user = userEvent.setup();
  signInSocial.mockResolvedValue({ data: null, error: null });
  renderWithProviders(<GoogleSignInButton />);

  await user.click(screen.getByRole('button', { name: /sign in with google/i }));

  await waitFor(() => {
    expect(signInSocial).toHaveBeenCalledWith(
      expect.objectContaining({ callbackURL: '/ws' })
    );
  });
});

it('uses custom callbackURL when provided', async () => {
  const user = userEvent.setup();
  signInSocial.mockResolvedValue({ data: null, error: null });
  renderWithProviders(<GoogleSignInButton callbackURL="/accept-invite?id=abc" />);

  await user.click(screen.getByRole('button', { name: /sign in with google/i }));

  await waitFor(() => {
    expect(signInSocial).toHaveBeenCalledWith(
      expect.objectContaining({ callbackURL: '/accept-invite?id=abc' })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @workspace/web test test/unit/components/auth/google-sign-in-button.test.tsx`
Expected: FAIL — `callbackURL` prop not accepted.

- [ ] **Step 3: Implement `GoogleSignInButton` changes**

Update `apps/web/src/components/auth/google-sign-in-button.tsx`:

```tsx
const DEFAULT_CALLBACK_URL = '/ws';

export function GoogleSignInButton({
  callbackURL = DEFAULT_CALLBACK_URL,
}: {
  callbackURL?: string;
}) {
  // ... existing state ...

  const handleClick = async () => {
    setIsPending(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.social({
      provider: 'google',
      callbackURL,
      errorCallbackURL: '/signin',
    });
    // ... existing error handling ...
  };

  // ... existing JSX (unchanged) ...
}
```

- [ ] **Step 4: Update mock to accept `callbackURL` prop**

Update `apps/web/test/mocks/google-sign-in-button.ts`:

```ts
import * as React from 'react';

/**
 * Creates a mock for the GoogleSignInButton component.
 * Avoids OAuth setup in tests that render auth forms.
 */
export function createGoogleSignInButtonMock() {
  return {
    GoogleSignInButton: ({ callbackURL }: { callbackURL?: string }) =>
      React.createElement(
        'button',
        { 'data-callback-url': callbackURL },
        'Sign in with Google'
      ),
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @workspace/web test test/unit/components/auth/google-sign-in-button.test.tsx`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/auth/google-sign-in-button.tsx apps/web/test/unit/components/auth/google-sign-in-button.test.tsx apps/web/test/mocks/google-sign-in-button.ts
git commit -m "feat(auth): add callbackURL prop to GoogleSignInButton"
```

---

### Task 3: Update `SigninForm` to Thread `redirect` Param

**Files:**

- Modify: `apps/web/src/components/auth/signin-form.tsx`
- Modify: `apps/web/test/unit/components/auth/signin-form.test.tsx`
- Modify: `apps/web/src/routes/_auth/signin.tsx`

- [ ] **Step 1: Write failing tests**

Add to `apps/web/test/unit/components/auth/signin-form.test.tsx`:

```ts
it('uses redirect as callbackURL when provided', async () => {
  const user = userEvent.setup();
  signInEmail.mockResolvedValue({ data: {}, error: null });
  renderWithProviders(<SigninForm redirect="/accept-invite?id=abc" />);

  await user.type(screen.getByLabelText(/email/i), 'test@example.com');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /sign in$/i }));

  await waitFor(() => {
    expect(signInEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackURL: '/accept-invite?id=abc',
      })
    );
  });
});

it('falls back to /ws when redirect is not provided', async () => {
  const user = userEvent.setup();
  signInEmail.mockResolvedValue({ data: {}, error: null });
  renderWithProviders(<SigninForm />);

  await user.type(screen.getByLabelText(/email/i), 'test@example.com');
  await user.type(screen.getByLabelText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /sign in$/i }));

  await waitFor(() => {
    expect(signInEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackURL: '/ws',
      })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @workspace/web test test/unit/components/auth/signin-form.test.tsx`
Expected: FAIL — `redirect` prop not consumed.

- [ ] **Step 3: Implement `SigninForm` changes**

Update `apps/web/src/components/auth/signin-form.tsx`:

Add `redirect` prop, use as `callbackURL`, thread to `GoogleSignInButton` and cross-links.

```tsx
const DEFAULT_CALLBACK_URL = '/ws';

export function SigninForm({
  oauthError,
  redirect,
}: {
  oauthError?: string;
  redirect?: string;
}) {
  const navigate = useNavigate();
  const callbackURL = redirect ?? DEFAULT_CALLBACK_URL;

  const form = useForm({
    // ... existing defaultValues, validators ...
    onSubmit: async ({ value, formApi }) => {
      const { error } = await authClient.signIn.email({
        email: value.email,
        password: value.password,
        callbackURL,
      });
      if (error) {
        if (error.status === 403) {
          navigate({ to: '/verify', search: { email: value.email, redirect } });
          return;
        }
        // ... existing error handling ...
      }
    },
  });

  return (
    <>
      <Card>
        {/* ... existing CardHeader ... */}
        <CardContent>
          <form /* ... existing props ... */>
            <FieldGroup>
              <GoogleSignInButton callbackURL={callbackURL} />
              {/* ... existing fields ... */}
              <Field>
                <FormSubmitButton form={form} label="Sign in" />
                <FieldDescription className="text-center">
                  Don&apos;t have an account?{' '}
                  <Link to="/signup" search={{ redirect }}>
                    Sign up
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      {/* ... existing footer ... */}
    </>
  );
}
```

- [ ] **Step 4: Update signin route to pass `redirect`**

Update `apps/web/src/routes/_auth/signin.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { signinSearchSchema } from '@workspace/auth/schemas';
import { SigninForm } from '@/components/auth/signin-form';

export const Route = createFileRoute('/_auth/signin')({
  component: SigninPage,
  validateSearch: (search) => signinSearchSchema.parse(search),
});

function SigninPage() {
  const { error, redirect } = Route.useSearch();
  return <SigninForm oauthError={error} redirect={redirect} />;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @workspace/web test test/unit/components/auth/signin-form.test.tsx`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/auth/signin-form.tsx apps/web/src/routes/_auth/signin.tsx apps/web/test/unit/components/auth/signin-form.test.tsx
git commit -m "feat(auth): thread redirect param through SigninForm"
```

---

### Task 4: Update `SignupForm` to Thread `redirect` Param

**Files:**

- Modify: `apps/web/src/components/auth/signup-form.tsx`
- Modify: `apps/web/test/unit/components/auth/signup-form.test.tsx`
- Modify: `apps/web/src/routes/_auth/signup.tsx`

- [ ] **Step 1: Write failing tests**

Add to `apps/web/test/unit/components/auth/signup-form.test.tsx`:

```ts
it('uses redirect as callbackURL when provided', async () => {
  const user = userEvent.setup();
  signUpEmail.mockResolvedValue({ data: {}, error: null });
  renderWithProviders(<SignupForm redirect="/accept-invite?id=abc" />);

  await user.type(screen.getByLabelText(/^email$/i), 'new@example.com');
  await user.type(screen.getByLabelText(/^password$/i), 'password123');
  await user.type(screen.getByLabelText(/confirm password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /create account/i }));

  await waitFor(() => {
    expect(signUpEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackURL: '/accept-invite?id=abc',
      })
    );
  });
});

it('navigates to /verify with redirect on successful signup', async () => {
  const user = userEvent.setup();
  signUpEmail.mockResolvedValue({ data: {}, error: null });
  renderWithProviders(<SignupForm redirect="/accept-invite?id=abc" />);

  await user.type(screen.getByLabelText(/^email$/i), 'new@example.com');
  await user.type(screen.getByLabelText(/^password$/i), 'password123');
  await user.type(screen.getByLabelText(/confirm password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /create account/i }));

  await waitFor(() => {
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/verify',
        search: { email: 'new@example.com', redirect: '/accept-invite?id=abc' },
      })
    );
  });
});

it('falls back to /ws when redirect is not provided', async () => {
  const user = userEvent.setup();
  signUpEmail.mockResolvedValue({ data: {}, error: null });
  renderWithProviders(<SignupForm />);

  await user.type(screen.getByLabelText(/^email$/i), 'new@example.com');
  await user.type(screen.getByLabelText(/^password$/i), 'password123');
  await user.type(screen.getByLabelText(/confirm password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /create account/i }));

  await waitFor(() => {
    expect(signUpEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackURL: '/ws',
      })
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @workspace/web test test/unit/components/auth/signup-form.test.tsx`
Expected: FAIL — `redirect` prop not consumed.

- [ ] **Step 3: Implement `SignupForm` changes**

Update `apps/web/src/components/auth/signup-form.tsx`:

```tsx
const DEFAULT_CALLBACK_URL = '/ws';

export function SignupForm({ redirect }: { redirect?: string }) {
  const navigate = useNavigate();
  const callbackURL = redirect ?? DEFAULT_CALLBACK_URL;

  const form = useForm({
    // ... existing defaultValues, validators ...
    onSubmit: async ({ value, formApi }) => {
      const { error } = await authClient.signUp.email({
        email: value.email,
        password: value.password,
        name: value.email.split('@')[0] ?? '',
        callbackURL,
      });
      if (error) {
        // ... existing error handling ...
        return;
      }
      navigate({ to: '/verify', search: { email: value.email, redirect } });
    },
  });

  return (
    <>
      <Card>
        {/* ... existing CardHeader ... */}
        <CardContent>
          <form /* ... existing props ... */>
            <FieldGroup>
              <GoogleSignInButton callbackURL={callbackURL} />
              {/* ... existing fields ... */}
              <Field>
                <FormSubmitButton form={form} label="Create Account" />
                <FieldDescription className="text-center">
                  Already have an account?{' '}
                  <Link to="/signin" search={{ redirect }}>
                    Sign in
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      {/* ... existing footer ... */}
    </>
  );
}
```

- [ ] **Step 4: Update signup route to parse and pass `redirect`**

Update `apps/web/src/routes/_auth/signup.tsx`:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { signupSearchSchema } from '@workspace/auth/schemas';
import { SignupForm } from '@/components/auth/signup-form';

export const Route = createFileRoute('/_auth/signup')({
  component: SignUpPage,
  validateSearch: (search) => signupSearchSchema.parse(search),
});

function SignUpPage() {
  const { redirect } = Route.useSearch();
  return <SignupForm redirect={redirect} />;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @workspace/web test test/unit/components/auth/signup-form.test.tsx`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/auth/signup-form.tsx apps/web/src/routes/_auth/signup.tsx apps/web/test/unit/components/auth/signup-form.test.tsx
git commit -m "feat(auth): thread redirect param through SignupForm"
```

---

### Task 5: Update Verify Page to Thread `redirect` Param

**Files:**

- Modify: `apps/web/src/routes/_auth/verify.tsx`

**Note:** Before implementing, confirm that Better Auth's `sendVerificationEmail` honors `callbackURL` by checking their docs or source. If it doesn't pass `callbackURL` through to the post-verification redirect, the cookie fallback approach from the spec note may be needed. Check `@workspace/auth` source or Better Auth docs for `sendVerificationEmail` behavior.

- [ ] **Step 1: Implement verify page changes**

Update `apps/web/src/routes/_auth/verify.tsx` — read `redirect` from search params and thread to `callbackURL`:

```tsx
function VerifyPage() {
  const { email, redirect } = Route.useSearch();
  // ... existing isResending state ...

  // ... existing email check ...

  async function handleResend() {
    if (!email) return;
    setIsResending(true);
    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: redirect ?? '/ws',
      });
      // ... existing error/success handling ...
    } finally {
      setIsResending(false);
    }
  }

  // ... existing JSX (unchanged) ...
}
```

No schema change needed — `verifySearchSchema` was already updated in Task 1 to include `redirect`.

- [ ] **Step 2: Run full test suite to ensure no regressions**

Run: `pnpm --filter @workspace/web test`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/_auth/verify.tsx
git commit -m "feat(auth): thread redirect param through verify page callbackURL"
```

---

### Task 6: Update `accept-invite.tsx` to Redirect with Context

**Files:**

- Modify: `apps/web/src/routes/accept-invite.tsx`

- [ ] **Step 1: Implement accept-invite redirect changes**

Update `apps/web/src/routes/accept-invite.tsx` — redirect unauthenticated users to `/signup` with `redirect` param:

```tsx
React.useEffect(() => {
  if (isPending) return;
  if (didRunRef.current) return;
  didRunRef.current = true;

  const run = async () => {
    if (!id) {
      setState({ kind: 'invalid', message: 'Invitation link is invalid.' });
      return;
    }

    const returnTo = `/accept-invite?id=${encodeURIComponent(id)}`;

    if (!session) {
      await navigate({ to: '/signup', search: { redirect: returnTo } });
      return;
    }

    // Logged in but email not verified — sign out and redirect to signup.
    if (!session.user.emailVerified) {
      await authClient.signOut();
      await navigate({ to: '/signup', search: { redirect: returnTo } });
      return;
    }

    setState({ kind: 'working', message: 'Accepting invitation...' });
    const accepted = await authClient.organization.acceptInvitation({
      invitationId: id,
    });

    if (accepted.error) {
      await authClient.signOut();
      setState({
        kind: 'error',
        message: accepted.error.message ?? 'Failed to accept invitation.',
      });
      return;
    }

    await navigate({ to: '/ws' });
  };

  void run();
}, [id, isPending, navigate, session]);
```

- [ ] **Step 2: Run full test suite and typecheck**

Run: `pnpm run typecheck && pnpm test`
Expected: ALL PASS, no type errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/routes/accept-invite.tsx
git commit -m "feat(auth): redirect unauthenticated users to signup with invitation context"
```

---

### Task 7: Final Verification

- [ ] **Step 1: Run full typecheck**

Run: `pnpm run typecheck`
Expected: No errors

- [ ] **Step 2: Run full lint**

Run: `pnpm run lint`
Expected: No errors (or only pre-existing ones)

- [ ] **Step 3: Run all tests**

Run: `pnpm test`
Expected: ALL PASS

- [ ] **Step 4: Manual smoke test (if dev server available)**

1. Start dev server: `pnpm dev`
2. Navigate to `/accept-invite?id=test` while logged out
3. Verify redirect to `/signup?redirect=%2Faccept-invite%3Fid%3Dtest`
4. Verify "Sign in" link preserves redirect param
5. Verify Google sign-in button would use correct callbackURL (check network tab)

- [ ] **Step 5: Final commit if any lint/format fixes needed**

```bash
git add -A && git commit -m "chore: lint and format fixes"
```
