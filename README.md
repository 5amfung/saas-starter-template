# SaaS Starter Template

A production-ready SaaS foundation with authentication, multi-tenant workspaces, Stripe billing, and an admin dashboard — built on TanStack Start, React 19, and shadcn/ui.

<!-- Add screenshot here -->

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
| Testing     | Vitest + Testing Library                          |
| Build       | Vite 7, Nitro                                     |

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

- [Node.js](https://nodejs.org/) v22+
- [pnpm](https://pnpm.io/)
- [Neon](https://neon.tech/) PostgreSQL database
- [Stripe](https://stripe.com/) account with products and prices configured
- [Resend](https://resend.com/) account
- [Google Cloud Console](https://console.cloud.google.com/) OAuth credentials

## Quick Start

1. **Clone the repository**

   ```bash
   git clone <repo-url>
   cd sass-starter-template
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Fill in the values for Neon, Resend, Stripe, Google OAuth, and Better Auth secret.

4. **Push database schema**

   ```bash
   pnpm run db:push
   ```

5. **Start the dev server**

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000) to see the app.

## Project Structure

```
src/
├── account/        # Account settings server functions and schemas
├── admin/          # Admin server functions and validation
├── auth/           # Better Auth server/client setup and permissions
├── billing/        # Stripe billing logic, plans, and server functions
├── components/     # Reusable UI and feature components
├── db/             # Drizzle ORM schema and database client
├── email/          # Email provider integration and helpers
├── hooks/          # Shared custom React hooks
├── lib/            # Framework-agnostic utilities
├── middleware/     # Auth and admin request middleware
├── routes/         # TanStack Router file-based route modules
├── types/          # Project-level TypeScript type declarations
└── workspace/      # Workspace/multi-tenancy logic and tests
```

## Available Scripts

| Command                | Description                          |
| ---------------------- | ------------------------------------ |
| `pnpm dev`             | Start dev server on port 3000        |
| `pnpm run build`       | Production build                     |
| `pnpm run preview`     | Preview production build             |
| `pnpm test`            | Run all tests with Vitest            |
| `pnpm run check`       | Type-check + lint                    |
| `pnpm run format`      | Format code with Prettier            |
| `pnpm run db:generate` | Generate Drizzle migration files     |
| `pnpm run db:migrate`  | Apply migrations                     |
| `pnpm run db:push`     | Push schema directly (dev only)      |
| `pnpm run db:studio`   | Open Drizzle Studio                  |
| `pnpm run email:dev`   | Preview email templates on port 3001 |

## Deployment

TanStack Start uses [Nitro](https://nitro.build/) as its server layer, supporting multiple deployment targets including Vercel, Cloudflare, and traditional Node.js servers. Set `BETTER_AUTH_URL` to your production domain before deploying.

See the [TanStack Start deployment docs](https://tanstack.com/start/latest/docs/framework/react/hosting) for platform-specific configuration.

## Contributing

Contributions are welcome. Please open an issue to discuss changes before submitting a pull request.

## License

MIT
