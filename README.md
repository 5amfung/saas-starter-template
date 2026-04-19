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
 cp apps/web/.env.example apps/web/.env
 cp apps/admin/.env.example apps/admin/.env
 cp packages/db-schema/.env.example packages/db-schema/.env
```

Fill in the values for Neon, Resend, Stripe, Google OAuth, Better Auth,
and any optional Sentry settings.

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
│   └── web/                  # TanStack Start application (main SaaS app)
│       └── src/
│           ├── account/      # Account settings server functions and schemas
│           ├── admin/        # Admin server functions and validation
│           ├── billing/      # Stripe billing logic, plans, and server functions
│           ├── components/   # App-specific feature components
│           ├── hooks/        # Custom React hooks
│           ├── lib/          # App-level utilities
│           ├── middleware/   # Auth and admin request middleware
│           ├── routes/       # TanStack Router file-based route modules
│           ├── types/        # TypeScript type declarations
│           └── workspace/    # Workspace/multi-tenancy logic and tests
├── packages/
│   ├── auth/                 # Better Auth server/client setup, permissions, and schemas
│   ├── db/                   # Drizzle ORM schema, database client, and migrations
│   ├── email/                # Email provider integration and React Email templates
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
| `@workspace/web`           | Main SaaS application (TanStack Start + Vite)          |
| `@workspace/auth`          | Authentication logic (Better Auth server/client setup) |
| `@workspace/db`            | Database schema and client (Drizzle ORM + Neon)        |
| `@workspace/email`         | Email sending and React Email templates                |
| `@workspace/ui`            | Shared UI components (shadcn/ui, Recharts, styles)     |
| `@workspace/eslint-config` | Shared ESLint configuration (TanStack + React presets) |
| `@workspace/test-utils`    | Shared test setup and utilities                        |

## Available Scripts

### Root Commands (via Turborepo)

| Command           | Description                      |
| ----------------- | -------------------------------- |
| `pnpm dev`        | Start all dev servers            |
| `pnpm run build`  | Production build (all packages)  |
| `pnpm test`       | Run all tests with Vitest        |
| `pnpm run check`  | Type-check + lint (all packages) |
| `pnpm run lint`   | Lint all packages                |
| `pnpm run format` | Format code with Prettier        |

### Database Commands

| Command                    | Description                        |
| -------------------------- | ---------------------------------- |
| `pnpm run db:generate`     | Generate Drizzle migration files   |
| `pnpm run db:migrate`      | Apply migrations                   |
| `pnpm run db:push`         | Push schema directly (dev only)    |
| `pnpm run db:studio`       | Open Drizzle Studio                |
| `pnpm run gen-auth-schema` | Regenerate auth schema from config |

### App-Specific Commands

| Command                       | Description                               |
| ----------------------------- | ----------------------------------------- |
| `pnpm run dev:web`            | Start only the web app dev server         |
| `pnpm run dev:stripe-webhook` | Forward Stripe webhooks to localhost:3000 |

### Running Commands in a Specific Package

```bash
pnpm --filter @workspace/web <command>
pnpm --filter @workspace/db <command>
pnpm --filter @workspace/email dev:email    # Preview email templates on port 3001
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

This repository is a monorepo, so deployment happens per app or service,
not from a single root `.output` bundle.

### Railway

The recommended Railway setup is one service per deployable app:

- `apps/web` for the customer-facing app
- `apps/admin` for the admin app
- `apps/api-server` for the standalone Hono API server, if you use it

For the TanStack Start apps (`apps/web` and `apps/admin`), set the Railway
service root directory to the app folder and use the package scripts:

```bash
pnpm run build
pnpm run start
```

Those scripts build Nitro output into the app-local `.output/` directory and
start the server with the required Sentry instrumentation import.

If you deploy from the repository root instead of a service root directory,
use app-specific filtered commands rather than the root build:

```bash
pnpm --filter @workspace/web run build
pnpm --filter @workspace/web run start
```

or

```bash
pnpm --filter @workspace/admin-web run build
pnpm --filter @workspace/admin-web run start
```

For the API server, use:

```bash
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/api-server run start
```

### Required production environment variables

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

### Sentry configuration

Sentry uses this runtime DSN:

- `VITE_SENTRY_DSN` for both the browser bundle and the server runtime

Source map upload during production builds uses:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

Use `VITE_SENTRY_DISABLED=true` to disable Sentry for an app run. The same
flag is read by browser runtime code, server bootstrap code, and the Vite
build plugin gating used for source map upload.

Production deploys on Railway or CI should use the normal `build` command.
The dedicated `build:e2e` command is only for Playwright test builds and
sets `VITE_SENTRY_DISABLED=true` so Sentry stays off during the test build
and test runtime.

See the [TanStack Start deployment docs](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
for additional platform-specific guidance.

## Contributing

Contributions are welcome! Please read the [Contributing Guide](.github/CONTRIBUTING.md) before submitting a pull request.

For security vulnerabilities, please see our [Security Policy](SECURITY.md).

## License

[MIT](LICENSE)
