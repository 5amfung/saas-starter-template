# SaaS Starter Template

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D10-orange)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](.github/CONTRIBUTING.md)

A production-ready SaaS foundation with authentication, multi-tenant workspaces, Stripe billing, and an admin dashboard — built on TanStack Start, React 19, and shadcn/ui.

## Tech Stack

| Layer       | Technology                                        |
| ----------- | ------------------------------------------------- |
| Framework   | TanStack Start + TanStack Router + TanStack Query |
| UI          | React 19, shadcn/ui, Base UI                      |
| Styling     | Tailwind CSS v4, OKLCH color system               |
| Auth        | Better Auth                                       |
| Database    | Neon PostgreSQL + Drizzle ORM                     |
| Payments    | Stripe (subscriptions, billing portal)            |
| Email       | Resend + React Email                              |
| Icons       | Tabler Icons                                      |
| Charts      | Recharts                                          |
| Data Tables | TanStack Table                                    |
| Validation  | Zod v4                                            |
| Testing     | Vitest + Testing Library, Playwright (E2E)        |
| Build       | Vite 7, Nitro, Turborepo                          |

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
- ✅ Upgrade prompts when limits reached

### Admin Dashboard

- ✅ User count metrics (total, verified, unverified)
- ✅ Signup analytics chart (configurable time range)
- ✅ Monthly Active Users chart
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

- ✅ 25+ shadcn/ui components (base-vega style)
- ✅ Dark mode support
- ✅ Mobile-first responsive design
- ✅ Interactive charts and data tables
- ✅ Dynamic breadcrumb navigation
- ✅ File-based routing
- ✅ TanStack Start server functions
- ✅ Strict TypeScript
- ✅ ESLint + Prettier

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/)
- [Neon](https://neon.tech/) PostgreSQL database
- [Stripe](https://stripe.com/) account with products and prices configured
- [Resend](https://resend.com/) account
- [Google Cloud Console](https://console.cloud.google.com/) OAuth credentials

## Quick Start

1. **Clone the repository**

```bash
 git clone <repo-url>
 cd saas-starter-template
```

2. **Install dependencies**

```bash
 pnpm install
```

3. **Set up environment variables**

```bash
 cp apps/web/.env apps/web/.env.local
```

The committed `apps/web/.env` file provides defaults and the list of
supported variables. Fill in private local values in `apps/web/.env.local`
for Neon, Resend, Stripe, Google OAuth, Better Auth, and any optional
Sentry settings.

4. **Push database schema**

```bash
 pnpm run db:push
```

5. **Start the dev server**

```bash
 pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Monorepo Structure

This project is organized as a monorepo using [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turbo.build/repo).

```
saas-starter-template/
├── apps/
│   ├── web/                  # TanStack Start application (SaaS + admin)
│   │   └── src/
│   │       ├── account/      # Account settings server functions and schemas
│   │       ├── admin/        # Admin server functions and validation
│   │       ├── billing/      # Stripe billing logic, plans, and server functions
│   │       ├── components/   # App-specific feature components
│   │       ├── db/           # Drizzle schema and database access
│   │       ├── email/        # Resend integration and React Email templates
│   │       ├── hooks/        # Custom React hooks
│   │       ├── lib/          # App-level utilities
│   │       ├── middleware/   # Auth and admin request middleware
│   │       ├── routes/       # TanStack Router file-based route modules
│   │       ├── types/        # TypeScript type declarations
│   │       └── workspace/    # Workspace/multi-tenancy logic and tests
│   └── api-server/           # Optional standalone Hono API server
├── packages/
│   ├── eslint-config/        # Shared ESLint configuration
│   ├── test-utils/           # Shared testing utilities (Testing Library, etc.)
│   └── ui/                   # shadcn/ui components, styles, and shared UI primitives
├── turbo.json                # Turborepo task pipeline configuration
├── pnpm-workspace.yaml       # pnpm workspace definition
└── package.json              # Root scripts and shared dev dependencies
```

### Workspace Packages

| Package                    | Description                                            |
| -------------------------- | ------------------------------------------------------ |
| `@workspace/web`           | SaaS and admin application (TanStack Start + Vite)     |
| `@workspace/api-server`    | Optional standalone Hono API server                    |
| `@workspace/ui`            | Shared UI components (shadcn/ui, Recharts, styles)     |
| `@workspace/eslint-config` | Shared ESLint configuration (TanStack + React presets) |
| `@workspace/test-utils`    | Shared test setup and utilities                        |

## Available Scripts

### Root Commands (via Turborepo)

| Command           | Description                                      |
| ----------------- | ------------------------------------------------ |
| `pnpm dev`        | Start the web app and Stripe webhook dev servers |
| `pnpm dev:api`    | Start the optional Hono API server               |
| `pnpm run build`  | Production build (all packages)                  |
| `pnpm test`       | Run all tests with Vitest                        |
| `pnpm run check`  | Type-check + lint (all packages)                 |
| `pnpm run lint`   | Lint all packages                                |
| `pnpm run format` | Format code with Prettier                        |

### Database Commands

| Command                | Description                      |
| ---------------------- | -------------------------------- |
| `pnpm run db:generate` | Generate Drizzle migration files |
| `pnpm run db:migrate`  | Apply migrations                 |
| `pnpm run db:push`     | Push schema directly (dev only)  |
| `pnpm run db:studio`   | Open Drizzle Studio              |

`apps/web/src/db/schema/auth.schema.ts` is hand-maintained. Do not regenerate it
in place. If you need Better Auth's latest generated schema as a reference
during an upgrade, generate it to a temporary file and manually port the needed
changes:

```bash
pnpm dlx @better-auth/cli generate \
  --config apps/web/src/auth/server/auth.cli.ts \
  --output /tmp/better-auth-auth.schema.ts \
  --yes
```

Then diff the temporary file against `apps/web/src/db/schema/auth.schema.ts` and
copy over the desired Better Auth schema changes by hand, preserving any
repo-owned indexes or other Drizzle customizations.

### App-Specific Commands

| Command                                           | Description                                             |
| ------------------------------------------------- | ------------------------------------------------------- |
| `pnpm --filter @workspace/web dev`                | Start the TanStack Start dev server                     |
| `pnpm --filter @workspace/web dev:email`          | Preview React Email templates on port 3001              |
| `pnpm --filter @workspace/web dev:stripe-webhook` | Forward Stripe webhooks to localhost:3000               |
| `pnpm --filter @workspace/web build:vite`         | Run the raw Vite/Nitro build                            |
| `pnpm --filter @workspace/web build`              | Build standalone Node Nitro output and copy preloads    |
| `pnpm --filter @workspace/web vercel-build`       | Run migrations, then build with the Nitro Vercel preset |
| `pnpm --filter @workspace/web start`              | Run the standalone Node Nitro server                    |

### Running Commands in a Specific Package

```bash
pnpm --filter @workspace/web <command>
pnpm --filter @workspace/web dev:email    # Preview email templates on port 3001
```

## End-to-End Testing with Playwright

This project includes AI-assisted Playwright agents that can plan, generate, and heal end-to-end tests through natural language prompts.

### Prerequisites

The Playwright MCP (Model Context Protocol) server must be running for the agents to interact with the browser. The server is configured in `.mcp.json`:

```json
{
  "mcpServers": {
    "playwright-test": {
      "command": "pnpm",
      "args": [
        "--filter",
        "@workspace/web",
        "exec",
        "playwright",
        "run-test-mcp-server"
      ]
    }
  }
}
```

Make sure Playwright browsers are installed if you haven't done this already:

```bash
pnpm --filter @workspace/web exec playwright install
```

### Playwright Agents

Three specialized AI agents (saved in `~/.claude/agents`) handle different phases of the E2E testing workflow:

| Agent              | Purpose                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Test Planner**   | Navigates your app in a real browser, explores the UI, and produces a comprehensive test plan saved to `apps/web/specs/`.       |
| **Test Generator** | Takes a test plan and executes each step in a real browser, then writes a working `.spec.ts` file from the recorded actions.    |
| **Test Healer**    | Runs existing tests, debugs failures by inspecting the browser state, and fixes broken selectors, assertions, or timing issues. |

### Workflow

See [Playwright test agents](https://playwright.dev/docs/test-agents).

### Running E2E Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run a specific test file
pnpm --filter @workspace/web test:e2e test/e2e/example.spec.ts

# View the HTML test report
pnpm --filter @workspace/web test:e2e:report
```

### Test Plan Directory

Test plans generated by the planner agent are saved to `apps/web/specs/`. See `apps/web/specs/README.md` for details on the format.

## Deployment

This repository is a monorepo, so deployment happens per app or service. The
main deployable app is `apps/web`, which serves customer routes at `/`,
workspace routes under `/ws`, and platform administration routes under
`/admin`.

### Vercel

Use one Vercel Project for `apps/web`.

Recommended project settings:

| Setting          | Value                   |
| ---------------- | ----------------------- |
| Root Directory   | `apps/web`              |
| Build Command    | `pnpm run vercel-build` |
| Install Command  | Vercel default          |
| Output Directory | Vercel default          |

In Vercel, enable a production Deployment Check for the GitHub commit status
named `Vercel - saas-demo: Typecheck, Lint & Tests`. Vercel will still create a
production deployment when changes land on `main`, but the deployment should
not be promoted to the production domain until that check passes.

`apps/web/vercel.json` pins the build command:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "pnpm run vercel-build"
}
```

Do not configure a Vercel production start command. Vercel builds the app, then
serves generated static assets and Vercel Functions. The app selects Nitro's
Vercel output with:

```bash
pnpm run db:migrate && NITRO_PRESET=vercel pnpm run build:vite
```

That command runs migrations before build. Keep migrations backward-compatible:
if a migration succeeds and the later build fails, the database can be ahead of
the deployed code. If a release needs strict ordering beyond this simple
build-time flow, let a separate release workflow own "migrate, then deploy."

### Standalone Node Hosting

The web app also keeps a standalone Nitro Node path for Docker, Railway, Fly,
Render, or VM-style hosting:

```bash
pnpm --filter @workspace/web run build
pnpm --filter @workspace/web run start
```

The `build` script creates `.output/server` and copies the server Sentry preload
files. The `start` script then runs:

```bash
node --import ./.output/server/instrument.server.mjs .output/server/index.mjs
```

The optional Hono API server remains a separate service if you deploy it:

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

### Required Production Environment Variables

Set `BETTER_AUTH_URL` to the public URL of the deployed service.

Common production variables include:

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

### Sentry Configuration

Sentry uses separate browser and server runtime entry points:

- `VITE_SENTRY_DSN` for the browser bundle
- `SENTRY_DSN` for the server runtime, with `VITE_SENTRY_DSN` as a fallback

Source map upload during production builds uses:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Use `VITE_SENTRY_DISABLED=true` to disable Sentry for an app run. The same
flag is read by browser runtime code, server bootstrap code, and the Vite
build plugin gating used for source map upload.

On Vercel, server-side Sentry initialization runs from `src/server.ts` so it is
bundled into the generated Vercel Function. On standalone Node hosting, the same
initialization runs through the `node --import` preload used by `start`.

The dedicated `build:e2e` command is only for Playwright test builds and sets
`VITE_SENTRY_DISABLED=true` so Sentry stays off during the test build and test
runtime.

See the [TanStack Start deployment docs](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
for additional platform-specific guidance.

## Contributing

Contributions are welcome! Please read the [Contributing Guide](.github/CONTRIBUTING.md) before submitting a pull request.

For security vulnerabilities, please see our [Security Policy](SECURITY.md).

## License

[MIT](LICENSE)
