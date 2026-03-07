# Stripe Billing Integration Design

## Summary

Add subscription billing via Stripe using Better Auth's `@better-auth/stripe` plugin. Users can subscribe to a paid plan, cancel (effective at period end), and upgrade with proration. Invoices are fetched from Stripe API in real time.

## Tiers

| Plan    | ID(s)                       | Price          | Workspaces        | Members/Workspace |
| ------- | --------------------------- | -------------- | ----------------- | ----------------- |
| Starter | `starter`                   | Free           | 1 (personal only) | 1 (owner only)    |
| Pro     | `pro-monthly`, `pro-annual` | TBD/mo, TBD/yr | 5                 | 5                 |

- Two tiers shipped; config designed for easy addition of a third.
- Annual billing offers a discount (e.g., 2 months free).
- Prices and Stripe price IDs are configured in `src/billing/plans.ts`.

## Plan Configuration

Centralized typed config in `src/billing/plans.ts`:

```ts
type PlanId = 'starter' | 'pro-monthly' | 'pro-annual';

interface PlanLimits {
  maxWorkspaces: number; // -1 = unlimited
  maxMembersPerWorkspace: number; // -1 = unlimited
  // Extensible: add maxProjects, maxStorage, etc.
}

interface Plan {
  id: PlanId;
  name: string; // Display: "Starter", "Pro"
  stripePriceId: string | null; // null for free tier
  price: number; // Cents, 0 for free
  interval: 'month' | 'year' | null;
  limits: PlanLimits;
  features: string[]; // Display on billing page
}
```

Helper functions: `getPlanById()`, `getPlanByPriceId()`, `getFreePlan()`, `getUserPlanLimits()`.

## Server Integration

### Better Auth Stripe Plugin (`src/auth/auth.server.ts`)

- Add `@better-auth/stripe` plugin with `createCustomerOnSignUp: true`.
- `subscription.enabled: true` with plan entries mapping to Stripe price IDs.
- Webhooks auto-handled at `/api/auth/stripe/webhook`.

### Plan Limit Enforcement (`src/auth/auth-hooks.server.ts`)

Server-side hooks using Better Auth's database hooks:

- **`beforeCreateOrganization`**: Count user's workspaces vs plan's `maxWorkspaces`. Reject if at limit.
- **`beforeCreateInvitation`/member creation**: Count workspace members vs owner's plan's `maxMembersPerWorkspace`. Reject if at limit.

Hooks import plan limits from `src/billing/plans.ts`.

### Session Data

Better Auth exposes on session:

```
session.data?.user.subscription → { plan, status, periodEnd, cancelAtPeriodEnd }
```

Users with no subscription default to Starter.

## Billing Flows

### Subscribe (Starter → Pro)

1. User clicks "Upgrade" on billing page.
2. `authClient.subscription.create({ priceId })` → Stripe Checkout session.
3. User completes payment on Stripe's hosted page.
4. Webhook `customer.subscription.created` → Better Auth updates subscription → session reflects Pro.

### Cancel

1. User clicks "Manage" → Stripe Customer Portal → cancels.
2. Stripe sets `cancel_at_period_end = true`.
3. Webhook `customer.subscription.updated` → local record updated.
4. Billing page shows downgrade banner: "Your plan will downgrade to Starter on [date]."
5. Subscription remains active with Pro limits until period end.
6. At period end: `customer.subscription.deleted` → falls back to Starter.

### Reactivate (undo cancellation)

1. User clicks "Cancel" on the downgrade banner (meaning "cancel the cancellation").
2. Server function calls Stripe API to set `cancel_at_period_end = false`.
3. Subscription resumes normally.

### Upgrade (mid-cycle plan change)

Handled via Stripe Customer Portal. Stripe automatically prorates — charges new price minus unused portion of current plan.

## File Structure

### Domain logic

```
src/billing/
├── plans.ts              # Plan config (PLANS constant, types, helpers)
├── billing.functions.ts  # createServerFn wrappers (getInvoices, checkout, portal, reactivate)
└── billing.server.ts     # Server-only Stripe API helpers
```

### UI components

```
src/components/billing/
├── billing-page.tsx              # Main page composition
├── billing-plan-cards.tsx        # Current plan + upgrade card
├── billing-downgrade-banner.tsx  # Conditional cancellation banner
└── billing-invoice-table.tsx     # Invoice history with month filter
```

### Route

```
src/routes/_protected/_account/billing.tsx  # Existing placeholder, will be updated
```

## Billing Page UI

Three sections, matching the wireframe:

### 1. Downgrade Banner (conditional)

Shown when `cancelAtPeriodEnd === true`. Message: "Your plan will downgrade to Starter on [date]." Button: "Cancel" (reactivates).

### 2. Plan Cards (two-column grid)

- **Current Plan**: name, price, next billing date. "Manage" button → Stripe Portal.
- **Upgrade** (conditional): next tier name, price, features. "Upgrade" button → Stripe Checkout.

### 3. Invoice History Table

- Columns: Date, Status, Amount, Invoice (View link to Stripe PDF).
- Month selector dropdown filter.
- Data fetched from Stripe API via `getInvoices()` server function.

## Dependencies

- `@better-auth/stripe` — Better Auth Stripe plugin
- `stripe` — Stripe Node.js SDK

## Environment Variables

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Decisions

| Decision          | Choice                  | Rationale                                    |
| ----------------- | ----------------------- | -------------------------------------------- |
| Tier names        | Starter / Pro           | Clear, professional, room for future tiers   |
| Plan config       | Typed config file       | Simple, type-safe, single source of truth    |
| Billing cycles    | Monthly + Annual        | Standard SaaS pattern with annual discount   |
| Limit enforcement | Server-side hooks       | Secure, consistent, single enforcement point |
| Invoice storage   | Stripe API real-time    | Always accurate, no sync complexity          |
| Plan management   | Stripe Customer Portal  | PCI-compliant, less custom code              |
| Components dir    | src/components/billing/ | Dedicated billing UI directory               |
