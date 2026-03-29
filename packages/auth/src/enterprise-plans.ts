import type { Plan } from './plans';

// ────────────────────────────────────────────────────────────────────────────
// Enterprise plan registry — custom plans assigned to specific workspaces.
//
// Enterprise plans are hidden from the public billing UI and assigned
// manually via Stripe. Each entry follows the same Plan interface as
// self-serve plans but uses an `enterprise-` prefixed ID.
//
// To add a new enterprise plan:
//   1. Add an entry below with a unique `enterprise-<customer>` ID.
//   2. Create the corresponding product + prices in Stripe Dashboard.
//   3. Set STRIPE_ENTERPRISE_<CUSTOMER>_MONTHLY_PRICE_ID and
//      STRIPE_ENTERPRISE_<CUSTOMER>_ANNUAL_PRICE_ID env vars.
//   4. Deploy — limit enforcement and billing UI pick up the plan automatically.
// ────────────────────────────────────────────────────────────────────────────

export const ENTERPRISE_PLANS: ReadonlyArray<Plan> = [];
