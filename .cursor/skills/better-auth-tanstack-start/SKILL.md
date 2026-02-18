---
name: better-auth-tanstack-start
description: Integrate Better Auth with TanStack Start using Drizzle + Postgres. Covers core auth (email/password + sessions), Admin, Organization (Multi-tenant), Stripe (Subscriptions + Payments), Email OTP, Last Login Method, and social sign-in (Google, Apple, Microsoft). Use when adding or updating Better Auth in TanStack Start apps, wiring /api/auth routes, protecting routes with middleware, or configuring Drizzle/Postgres adapters and OAuth providers.
---

# Better Auth + TanStack Start + Drizzle (Postgres)

Use this skill when implementing authentication for this stack:

- **Framework**: TanStack Start (server routes + server functions + middleware).
- **Auth**: Better Auth (core + plugins).
- **DB**: Drizzle ORM with Postgres (adapter: `drizzleAdapter(..., { provider: "pg" })`).

## Quick start (recommended project layout)

- **Server auth config**: `src/auth/auth.server.ts`
- **Client auth client**: `src/auth/auth-client.ts`
- **Auth handler route** (mount Better Auth): `src/routes/api/auth/$.ts`
- **Route protection middleware**: `src/middleware/auth.ts`
- **Drizzle tables** (Better Auth models): `src/db/schema.ts`

## Implementation checklist

### 1) Install + env

- Install:

```bash
bun add better-auth
```

- Set these **server-only** env vars (do not use `VITE_` for secrets):

```txt
DATABASE_URL=postgres://...
BETTER_AUTH_SECRET=... # min 32 chars; recommended: `openssl rand -base64 32`
BETTER_AUTH_URL=http://localhost:3000
```

- Add provider env vars as needed (see [providers.md](providers.md)).

### 2) Create the Better Auth instance (server)

Create `src/auth/auth.server.ts` using:

- **Drizzle adapter** with Postgres provider.
- **Core**: `emailAndPassword` + `emailVerification` (optional but typical).
- **Plugins**:
  - `organization()` for multi-tenant teams.
  - `stripe()` for subscriptions and payments.
  - `admin()` for admin operations.
  - `emailOTP()` for verification codes and OTP-based flows.
  - `lastLoginMethod()` to track the user’s last sign-in method (UI hints; optional DB persistence).
  - `tanstackStartCookies()` **last** for automatic cookie handling in TanStack Start.

Also set:

- **`baseURL`** (or env `BETTER_AUTH_URL`) to prevent OAuth redirect mismatch.
- **`secret`** (or env `BETTER_AUTH_SECRET`) for signing/encryption.

### 3) Mount the auth handler in TanStack Start

Create a splat route at `src/routes/api/auth/$.ts`:

- Route path must be `/api/auth/$`.
- Forward `GET` and `POST` to `auth.handler(request)`.

This enables Better Auth endpoints like:
- `/api/auth/session`
- `/api/auth/sign-in/*`
- `/api/auth/callback/<provider>`

### 4) Create the client auth client (React)

Create `src/auth/auth-client.ts`:

- Use `createAuthClient` from `better-auth/react`.
- Add plugin clients for features you use:
  - `organizationClient()` (for teams/orgs).
  - `stripeClient()` (for subscriptions/payments).
  - `emailOTPClient()` (for OTP endpoints).
  - `adminClient()` (for admin endpoints).

### 5) Protect routes / server functions

For TanStack Start:

- Use `getRequestHeaders()` and `auth.api.getSession({ headers })` on the server.
- In middleware, redirect unauthenticated (or unverified) users to `/signin`.

See [tanstack-start.md](tanstack-start.md).

## Common tasks

### Add Google / Apple / Microsoft sign-in

- Configure providers in `socialProviders`.
- Ensure `BETTER_AUTH_URL` is correct for callback URL construction.
- For Apple, add `https://appleid.apple.com` to `trustedOrigins`.

See [providers.md](providers.md).

### Enable Organization (Multi-tenant) Support

- Add `organization()` plugin on server and `organizationClient()` on client.
- Run migrations to create organization tables.
- Use `authClient.organization` methods to create orgs and invite members.

See [organization.md](organization.md).

### Enable Stripe (Subscriptions & Payments)

- Install `@better-auth/stripe` and `stripe`.
- Add `stripe()` plugin on server and `stripeClient()` on client.
- Configure webhooks and environment variables.

See [stripe.md](stripe.md).

### Enable Email OTP verification codes

- Add the `emailOTP()` plugin.
- Implement `sendVerificationOTP({ email, otp, type })` to send email.
- If using OTP for email verification, set `overrideDefaultEmailVerification: true`.

See [email-otp.md](email-otp.md).

### Enable Admin plugin

- Add `admin()` plugin on server and `adminClient()` on client.
- Lock down admin access using `adminUserIds` and server-side checks.

See [admin.md](admin.md).

### Track “last login method” (Last Login Method plugin)

- Add `lastLoginMethod()` on the server and `lastLoginMethodClient()` on the client.
- Optionally enable `storeInDatabase: true` to persist `session.user.lastLoginMethod` and migrate your DB.

See [last-login-method.md](last-login-method.md).

### Keep Drizzle schema in sync

- Better Auth + plugins may require additional fields/tables.
- Prefer generating schema updates via Better Auth CLI and then applying migrations with Drizzle Kit.

See [drizzle-postgres.md](drizzle-postgres.md).

## Troubleshooting

- **OAuth `redirect_uri_mismatch`**:
  - Set `BETTER_AUTH_URL` (or `baseURL`) to your public origin.
  - Confirm provider callback is `https://<origin>/api/auth/callback/<provider>`.
- **Cookies not being set in TanStack Start**:
  - Ensure `tanstackStartCookies()` is installed and is the **last** plugin.
- **Admin endpoints failing**:
  - Ensure you included both `admin()` (server) and `adminClient()` (client).
  - Ensure the session user is in `adminUserIds` (or your server-side auth logic allows it).

## Additional resources

- TanStack Start patterns (server route handler, session helpers, middleware): [tanstack-start.md](tanstack-start.md)
- Organization (Multi-tenant) patterns: [organization.md](organization.md)
- Stripe (Subscriptions) patterns: [stripe.md](stripe.md)
- Provider config (Google/Apple/Microsoft): [providers.md](providers.md)
- Email OTP flows: [email-otp.md](email-otp.md)
- Admin plugin: [admin.md](admin.md)
- Last Login Method plugin: [last-login-method.md](last-login-method.md)
- Drizzle + Postgres schema/migrations: [drizzle-postgres.md](drizzle-postgres.md)
