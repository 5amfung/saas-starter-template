# README.md Design Spec

## Overview

Design for a public-facing README.md for the SaaS Starter Template project. The goal is to maximize views and adoption by making the feature density immediately visible.

**Audience:** Indie hackers, solopreneurs, developer teams, and agencies evaluating SaaS starter templates.

**Tone:** Professional and polished (Vercel/Supabase style). Minimal prose, dense feature grids, badges.

**Approach:** Feature Grid — leads with a one-liner + tech stack badges, then a dense feature grid organized by domain. Scannable in 30 seconds.

**Visuals:** No screenshots initially. A placeholder comment for future addition.

---

## Section 1: Header

- **Title:** `# SaaS Starter Template`
- **Tagline:** "A production-ready SaaS foundation with authentication, multi-tenant workspaces, Stripe billing, and an admin dashboard — built on TanStack Start, React 19, and shadcn/ui."
- **Badges:** TypeScript, License (MIT), pnpm, TanStack Start, React 19, Tailwind CSS v4
- **Screenshot placeholder:** `<!-- Add screenshot here -->` positioned after the tagline.

## Section 2: Tech Stack

Two-column table:

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

## Section 3: Features

Checkmark grid grouped by 7 domains. Each feature is a bullet with a checkmark emoji.

### Authentication

- Email & password with email verification
- Google OAuth with account linking
- Password reset flow
- Email change with confirmation
- Session management (view & revoke active sessions)
- Admin user impersonation
- User banning with optional expiration

### Multi-Tenant Workspaces

- Personal workspace auto-created on signup
- Team workspaces with member management
- Role-based access (owner, admin, member)
- Email invitations with expiration
- Workspace switcher in sidebar
- Active workspace tracked on session

### Stripe Billing

- Starter and Pro plans (monthly & annual)
- Checkout session creation
- Billing portal for self-serve management
- Invoice history
- Subscription lifecycle webhooks
- Plan-based feature gating (workspace limits, member limits)
- Upgrade prompts when limits reached

### Admin Dashboard

- User count metrics (total, verified, unverified)
- Signup analytics chart (configurable time range)
- Monthly Active Users chart
- User management table (search, filter, paginate)
- Ban/unban users with reason
- Edit and delete users

### Account Settings

- Edit profile (name, email, avatar)
- Change password / set password for OAuth accounts
- Linked accounts display
- Active sessions list
- Billing management (plan, invoices, billing portal)
- Notification preferences (marketing email opt-in/out)

### Email Templates

- Email verification
- Password reset
- Email change approval
- Workspace invitation
- Security notice
- React Email components with dev preview server

### UI & Developer Experience

- 25+ shadcn/ui components (base-vega style)
- Dark mode support
- Mobile-first responsive design
- Interactive charts and data tables
- Dynamic breadcrumb navigation
- File-based routing
- TanStack Start server functions
- Strict TypeScript
- ESLint + Prettier

## Section 4: Prerequisites

Short list of what's needed before setup:

- Node.js (version from `.node-version` or `package.json` engines)
- pnpm
- Neon PostgreSQL database
- Stripe account (with products/prices configured)
- Resend account
- Google OAuth credentials (for social login)

## Section 5: Quick Start

5-step setup with copy-pasteable commands:

1. Clone the repository
2. `pnpm install`
3. Copy `.env.example` to `.env` and fill in values (Neon, Resend, Stripe, Google OAuth, Better Auth secret)
4. `pnpm run db:push`
5. `pnpm dev`

No deep env var explanations — that belongs in `.env.example` comments or separate docs.

## Section 6: Project Structure

Condensed `src/` tree with one-line descriptions:

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

## Section 7: Available Scripts

| Command                | Description                          |
| ---------------------- | ------------------------------------ |
| `pnpm dev`             | Start dev server on port 3000        |
| `pnpm run build`       | Production build                     |
| `pnpm test`            | Run all tests with Vitest            |
| `pnpm run check`       | Type-check + lint                    |
| `pnpm run format`      | Format code with Prettier            |
| `pnpm run db:generate` | Generate Drizzle migration files     |
| `pnpm run db:migrate`  | Apply migrations                     |
| `pnpm run db:push`     | Push schema directly (dev only)      |
| `pnpm run db:studio`   | Open Drizzle Studio                  |
| `pnpm run preview`     | Preview production build             |
| `pnpm run email:dev`   | Preview email templates on port 3001 |

## Section 8: Deployment

Short paragraph noting that TanStack Start with Nitro supports multiple deployment targets. Mention the primary recommended platform (if any) and note that `BETTER_AUTH_URL` must be set for production. Can link to TanStack Start deployment docs.

## Section 9: Footer

- **Contributing:** "Contributions are welcome. Please open an issue to discuss changes before submitting a pull request."
- **License:** "MIT" with link to LICENSE file.
