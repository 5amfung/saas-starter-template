# Accept Invite Redirect Flow Design

**Date:** 2026-03-24
**Status:** Draft

## Problem

When a brand new (unauthenticated) user clicks a workspace invitation link (`/accept-invite?id=xyz`), the `accept-invite` page detects no session and redirects to `/signin` — but the invitation ID is lost. After signing up/in, the user lands at `/ws` and the invitation is never accepted.

## Solution

Preserve the invitation context through the auth flow using a `redirect` search parameter. When an unauthenticated user hits `/accept-invite`, redirect to `/signup?redirect=/accept-invite?id=xyz`. All auth forms (sign-in, sign-up, Google OAuth, email verification) pass the `redirect` value through as `callbackURL` instead of the hardcoded `'/ws'`.

## Approach

Standard redirect-based flow used by GitHub, Slack, and most SaaS products. The `redirect` param is a URL-encoded relative path preserved across all auth pages.

```
/accept-invite?id=abc123
  → (no session) → /signup?redirect=%2Faccept-invite%3Fid%3Dabc123
  → user signs up → /verify?email=...&redirect=%2Faccept-invite%3Fid%3Dabc123
  → user verifies email (callbackURL = /accept-invite?id=abc123)
  → /accept-invite?id=abc123 → invitation accepted → /ws
```

## File Changes

### 1. `packages/auth/src/schemas.ts`

Add `redirect` field to `signinSearchSchema`. Create a new `signupSearchSchema`. Both include an optional `redirect` field validated for safety. Update `verifySearchSchema` to include `redirect`.

```ts
const safeRedirectSchema = z
  .string()
  .refine((val) => val.startsWith('/') && !val.startsWith('//'))
  .optional();

export const signinSearchSchema = z.object({
  error: z.string().optional(),
  redirect: safeRedirectSchema,
});

export const signupSearchSchema = z.object({
  redirect: safeRedirectSchema,
});

export const verifySearchSchema = z.object({
  email: z.email({ error: 'Invalid email.' }).optional(),
  redirect: safeRedirectSchema,
});
```

### 2. `apps/web/src/routes/accept-invite.tsx`

**Line 50-53:** Change the unauthenticated redirect from `/signin` to `/signup` with the invitation return URL:

```ts
// Before
if (!session) {
  await navigate({ to: '/signin' });
  return;
}

// After
if (!session) {
  const returnTo = `/accept-invite?id=${encodeURIComponent(id)}`;
  await navigate({ to: '/signup', search: { redirect: returnTo } });
  return;
}
```

**Line 56-60:** Same for unverified email case — redirect to `/signup` with `redirect` param instead of bare `/signin`.

### 3. `apps/web/src/routes/_auth/signin.tsx`

Pass `redirect` from search params to `SigninForm`:

```ts
function SigninPage() {
  const { error, redirect } = Route.useSearch();
  return <SigninForm oauthError={error} redirect={redirect} />;
}
```

### 4. `apps/web/src/routes/_auth/signup.tsx`

Add `validateSearch` with `signupSearchSchema` and pass `redirect` to `SignupForm`:

```ts
export const Route = createFileRoute('/_auth/signup')({
  component: SignUpPage,
  validateSearch: (search) => signupSearchSchema.parse(search),
});

function SignUpPage() {
  const { redirect } = Route.useSearch();
  return <SignupForm redirect={redirect} />;
}
```

### 5. `apps/web/src/components/auth/signin-form.tsx`

- Accept `redirect` prop: `{ oauthError?: string; redirect?: string }`
- Use `redirect` as `callbackURL` in `authClient.signIn.email()` (line 42): `callbackURL: redirect ?? '/ws'`
- Pass `redirect` to `GoogleSignInButton`
- Preserve `redirect` in the "Sign up" link: `<Link to="/signup" search={{ redirect }}>Sign up</Link>`

### 6. `apps/web/src/components/auth/signup-form.tsx`

- Accept `redirect` prop: `{ redirect?: string }`
- Use `redirect` as `callbackURL` in `authClient.signUp.email()` (line 42): `callbackURL: redirect ?? '/ws'`
- Pass `redirect` to `GoogleSignInButton`
- Navigate to verify with `redirect`: `navigate({ to: '/verify', search: { email: value.email, redirect } })`
- Preserve `redirect` in the "Sign in" link: `<Link to="/signin" search={{ redirect }}>Sign in</Link>`

### 7. `apps/web/src/components/auth/google-sign-in-button.tsx`

- Accept optional `callbackURL` prop defaulting to `'/ws'`
- Use prop in `authClient.signIn.social()` (line 16): `callbackURL: callbackURL`

### 8. `apps/web/src/routes/_auth/verify.tsx`

- Read `redirect` from search params (schema already updated in step 1)
- Use in `callbackURL` for `sendVerificationEmail` (line 43): `callbackURL: redirect ?? '/ws'`

## Edge Cases

| Scenario                              | Behavior                                                         |
| ------------------------------------- | ---------------------------------------------------------------- |
| Existing signed-in user clicks invite | Accepts immediately — no change needed                           |
| New user, email/password signup       | Sign up → verify email → back to `/accept-invite` → accepted     |
| New user, Google OAuth                | Google sign-in → back to `/accept-invite` → accepted             |
| User toggles sign-up ↔ sign-in        | `redirect` param preserved in cross-links                        |
| No `redirect` param present           | Falls back to `'/ws'` — current behavior unchanged               |
| Malicious `redirect` value            | Rejected by `safeRedirectSchema` — must start with `/`, not `//` |
| Invitation already expired            | Handled by existing error state in `accept-invite.tsx`           |

## Security

The `redirect` param is validated with `safeRedirectSchema`:

- Must start with `/` (relative path only)
- Must NOT start with `//` (prevents protocol-relative open redirects)
- Optional — absent means default `/ws` behavior

This prevents open redirect attacks where an attacker crafts a URL like `/signin?redirect=https://evil.com`.

## Testing

- Unit test: `safeRedirectSchema` validates correctly (rejects `https://evil.com`, `//evil.com`, accepts `/accept-invite?id=abc`)
- Unit test: `SigninForm` and `SignupForm` use `redirect` as `callbackURL` when provided
- Unit test: `SigninForm` and `SignupForm` fall back to `/ws` when `redirect` is absent
- Unit test: `GoogleSignInButton` uses custom `callbackURL` prop
- Unit test: Cross-links (sign-in ↔ sign-up) preserve `redirect` param
- Integration test: Full flow — unauthenticated user clicking invite link → sign-up → verify → accept
