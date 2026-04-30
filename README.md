# SaaS Starter Template

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-10.33.1-orange)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)

## About

A production-ready SaaS foundation with authentication, multi-tenant workspaces,
Stripe billing, and an admin dashboard, built on TanStack Start, React 19, and
shadcn/ui.

## Features

### Authentication

- ✅ Email & password with email verification
- ✅ Google OAuth with account linking
- ✅ Password reset flow
- ✅ Email change with confirmation
- ✅ Session management (view & revoke active sessions)
- ✅ Admin user impersonation
- ✅ User banning with optional expiration

### Multi-Tenant Workspaces

- ✅ Personal workspace auto-created on signup
- ✅ Team workspaces with member management
- ✅ Role-based access (owner, admin, member)
- ✅ Email invitations with expiration
- ✅ Workspace switcher in sidebar
- ✅ Active workspace tracked on session

### Stripe Billing

- ✅ Starter and Pro plans (monthly & annual)
- ✅ Checkout session creation
- ✅ Billing portal for self-serve management
- ✅ Invoice history
- ✅ Subscription lifecycle webhooks
- ✅ Plan-based feature gating (workspace limits, member limits)
- ✅ Upgrade prompts when limits are reached

### Admin Dashboard

- ✅ User count metrics (total, verified, unverified)
- ✅ Signup analytics chart (configurable time range)
- ✅ Monthly active users chart
- ✅ User management table (search, filter, paginate)
- ✅ Ban/unban users with reason
- ✅ Edit and delete users

### Account Settings

- ✅ Edit profile (name, email, avatar)
- ✅ Change password / set password for OAuth accounts
- ✅ Linked accounts display
- ✅ Active sessions list
- ✅ Billing management (plan, invoices, billing portal)
- ✅ Notification preferences (marketing email opt-in/out)

### Email Templates

- ✅ Email verification
- ✅ Password reset
- ✅ Email change approval
- ✅ Workspace invitation
- ✅ Security notice
- ✅ React Email components with dev preview server

### UI & Developer Experience

- ✅ 25+ shadcn/ui components
- ✅ Dark mode support
- ✅ Mobile-first responsive design
- ✅ Interactive charts and data tables
- ✅ Dynamic breadcrumb navigation
- ✅ File-based routing
- ✅ TanStack Start server functions
- ✅ Strict TypeScript
- ✅ ESLint + Prettier

## Tech Stack

| Layer         | Technology                                    |
| ------------- | --------------------------------------------- |
| App framework | TanStack Start, TanStack Router, Nitro, Vite  |
| UI            | React 19, shadcn/ui, Base UI, Tailwind CSS v4 |
| Data          | Neon Postgres, Drizzle ORM, TanStack Query    |
| Auth          | Better Auth                                   |
| Billing       | Stripe                                        |
| Email         | Resend, React Email                           |
| Validation    | Zod v4                                        |
| Testing       | Vitest, Testing Library, Playwright           |
| Tooling       | pnpm workspaces, Turborepo, ESLint, Prettier  |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10.33.1+
- Neon Postgres database
- Stripe account with products and prices
- Resend account
- Google OAuth credentials

### Install

```bash
git clone <repo-url>
cd saas-starter-template
pnpm install
```

### Configure Environment

Use the committed `apps/web/.env` file as the variable reference, then put
private local values in `apps/web/.env.local`.

Common local variables include:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `WORKSPACE_SECRET_ENCRYPTION_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Prepare the Database

```bash
pnpm run db:push
```

Use `db:push` for local development. Use migrations for shared, preview, and
production environments.

### Run the App

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The root dev command starts
the web app and the Stripe webhook forwarding process for the web app.

## Repository Layout

```text
saas-starter-template/
├── apps/
│   ├── web/                  # TanStack Start SaaS app
│   │   ├── drizzle/          # Drizzle migration output
│   │   ├── src/
│   │   │   ├── account/      # Account settings functions and schemas
│   │   │   ├── admin/        # Admin server functions, queries, schemas
│   │   │   ├── api/          # App-owned API helpers and middleware
│   │   │   ├── auth/         # Better Auth client/server setup
│   │   │   ├── billing/      # Billing UI, server functions, core logic
│   │   │   ├── components/   # App-specific product components
│   │   │   ├── db/           # Drizzle client, schema, seed helpers
│   │   │   ├── email/        # Resend integration and React Email templates
│   │   │   ├── integrations/ # Workspace integration definitions/secrets
│   │   │   ├── observability/# Sentry and request logging helpers
│   │   │   ├── policy/       # Capability evaluators and server wrappers
│   │   │   ├── routes/       # TanStack Router file routes
│   │   │   └── workspace/    # Workspace queries, mutations, server functions
│   │   └── test/             # Unit, integration, and E2E tests
│   └── api-server/           # Optional standalone Hono API server
├── packages/
│   ├── eslint-config/        # Shared ESLint config and custom rules
│   ├── test-utils/           # Shared test and E2E helpers
│   └── ui/                   # Shared UI primitives, hooks, and styles
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Scripts

Run these from the repository root unless a package filter is shown.

### Root Commands

| Command                     | Description                                          |
| --------------------------- | ---------------------------------------------------- |
| `pnpm dev`                  | Start `@workspace/web` and Stripe webhook forwarding |
| `pnpm dev:api`              | Start the optional Hono API server                   |
| `pnpm run build`            | Build all packages through Turborepo                 |
| `pnpm run check`            | Run dependency boundaries, lint, and typecheck       |
| `pnpm run check:boundaries` | Validate app architecture boundaries                 |
| `pnpm run lint`             | Lint all packages                                    |
| `pnpm run typecheck`        | Typecheck all packages                               |
| `pnpm test`                 | Run all Vitest suites                                |
| `pnpm run test:unit`        | Run unit suites                                      |
| `pnpm run test:integration` | Run integration suites                               |
| `pnpm test:e2e`             | Run Playwright E2E through Turborepo                 |
| `pnpm run format`           | Format code with Prettier                            |

### Database Commands

These root scripts delegate to `@workspace/web`, where the Drizzle config and
schema live.

| Command                | Description                                |
| ---------------------- | ------------------------------------------ |
| `pnpm run db:generate` | Generate Drizzle migrations                |
| `pnpm run db:migrate`  | Apply Drizzle migrations                   |
| `pnpm run db:push`     | Push schema directly for local development |
| `pnpm run db:studio`   | Open Drizzle Studio                        |

### Web App Commands

```bash
pnpm --filter @workspace/web dev
pnpm --filter @workspace/web dev:email
pnpm --filter @workspace/web dev:stripe-webhook
pnpm --filter @workspace/web test
pnpm --filter @workspace/web test:e2e
pnpm --filter @workspace/web test:e2e:ui
pnpm --filter @workspace/web test:e2e:report
pnpm --filter @workspace/web build
pnpm --filter @workspace/web start
```

### API Server Commands

```bash
pnpm --filter @workspace/api-server dev
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/api-server start
```

## Database and Auth Schema Notes

The Drizzle schema source lives in `apps/web/src/db/schema/`, and migrations are
written under `apps/web/drizzle/`.

`apps/web/src/db/schema/auth.schema.ts` is repo-owned. Do not blindly overwrite
it with Better Auth CLI output. During a Better Auth upgrade, generate a
temporary reference schema, diff it against the repo-owned schema, and manually
port only the intended changes while preserving local indexes and
customizations.

## Testing

Install Playwright browsers once if needed:

```bash
pnpm --filter @workspace/web exec playwright install
```

Run E2E tests:

```bash
pnpm test:e2e
pnpm --filter @workspace/web test:e2e test/e2e/auth/signin.spec.ts
pnpm --filter @workspace/web test:e2e:report
```

The web app's E2E command builds with `E2E_MOCK_EMAIL=true` and
`VITE_SENTRY_DISABLED=true`, then runs Playwright against the built app.

## Deployment

### Vercel

Use one Vercel Project rooted at `apps/web`.

| Setting          | Value                   |
| ---------------- | ----------------------- |
| Root Directory   | `apps/web`              |
| Build Command    | `pnpm run vercel-build` |
| Install Command  | Vercel default          |
| Output Directory | Vercel default          |

`apps/web/vercel.json` pins the build command. The web app's Vercel build script
runs migrations before building with Nitro's Vercel preset:

```bash
pnpm run db:migrate && NITRO_PRESET=vercel pnpm run build:vite
```

Keep production migrations backward-compatible. If a migration succeeds and a
later build fails, the database may be ahead of the deployed code. For stricter
release ordering, let a separate release workflow own "migrate, then deploy."

### Standalone Node Hosting

The web app also supports a standalone Nitro Node build for Docker, Railway,
Fly, Render, or VM-style hosting:

```bash
pnpm --filter @workspace/web build
pnpm --filter @workspace/web start
```

The optional API server can deploy as a separate Node service:

```bash
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/api-server start
```

### Sentry

Browser instrumentation uses `VITE_SENTRY_DSN`. Server instrumentation uses
`SENTRY_DSN`, with `VITE_SENTRY_DSN` as a fallback.

Source map upload during production builds uses:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Set `VITE_SENTRY_DISABLED=true` to disable Sentry during local runs, E2E builds,
or environments where telemetry should be off.

## Contributing

Please read the [Contributing Guide](.github/CONTRIBUTING.md) before submitting
a pull request. For security issues, see [Security Policy](SECURITY.md).

## License

[MIT](LICENSE)
