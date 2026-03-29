---
name: better-auth-stripe
description: Integrate Stripe with Better Auth using the official Stripe plugin. Covers installation, customer creation on signup, subscription plans, checkout and billing portal, webhooks, reference system for users/organizations, lifecycle hooks, and schema. Use when adding or configuring Stripe payments, subscriptions, or billing in a Better Auth app.
---

# Better Auth Stripe Plugin

Integrate Stripe payments and subscriptions with Better Auth via the official `@better-auth/stripe` plugin. Based on [Better Auth Stripe docs](https://www.better-auth.com/docs/plugins/stripe).

## Installation

1. **Install the plugin** (client and server if split):
   ```bash
   bun add @better-auth/stripe
   ```

2. **Install Stripe SDK on the server**:
   ```bash
   bun add stripe@^20.0.0
   ```

3. **Server config** (`auth.ts` or equivalent):
   ```ts
   import { betterAuth } from "better-auth"
   import { stripe } from "@better-auth/stripe"
   import Stripe from "stripe"

   const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
     apiVersion: "2025-11-17.clover",
   })

   export const auth = betterAuth({
     // ... existing config
     plugins: [
       stripe({
         stripeClient,
         stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
         createCustomerOnSignUp: true,
       }),
     ],
   })
   ```

4. **Client config** (`auth-client.ts`):
   ```ts
   import { createAuthClient } from "better-auth/client"
   import { stripeClient } from "@better-auth/stripe/client"

   export const authClient = createAuthClient({
     // ... existing config
     plugins: [
       stripeClient({
         subscription: true, // enable subscription management
       }),
     ],
   })
   ```

5. **Database**: Run `npx auth migrate` or `npx auth generate` to add Stripe tables.

6. **Stripe webhook**: In Stripe Dashboard create an endpoint:
   - URL: `https://your-domain.com/api/auth/stripe/webhook` (adjust `/api/auth` if your base path differs)
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Set `STRIPE_WEBHOOK_SECRET` from the signing secret Stripe provides.

## Customer-Only (No Subscriptions)

Use the plugin just to link Stripe customers to users:

- Set `createCustomerOnSignUp: true`.
- Optionally use `onCustomerCreate` and `getCustomerCreateParams` to customize creation.

## Subscription Management

### Defining plans

Plans can be static or dynamic (e.g. from DB):

```ts
stripe({
  // ...
  subscription: {
    enabled: true,
    plans: [
      {
        name: "basic",
        priceId: "price_xxx",
        annualDiscountPriceId: "price_yyy", // optional
        limits: { projects: 5, storage: 10 },
      },
      {
        name: "pro",
        priceId: "price_zzz",
        limits: { projects: 20, storage: 50 },
        freeTrial: { days: 14 },
      },
    ],
  },
})
```

Plan names are lowercased when stored. For full plan options (e.g. `lookupKey`, `lineItems`, `seatPriceId`), see [reference.md](reference.md).

### Creating a subscription (checkout)

Client:

```ts
const { data, error } = await authClient.subscription.upgrade({
  plan: "pro",
  successUrl: "/dashboard",
  cancelUrl: "/pricing",
  annual: true,           // optional
  referenceId: "org_123", // optional; defaults by customerType
  seats: 5,               // optional; for team plans
  locale: "en",           // optional
})
```

**Important:** Only one active or trialing subscription per reference ID. If the user already has a subscription, pass `subscriptionId` when upgrading to avoid duplicate billing.

### Switching plans

Pass the current Stripe subscription ID so the user is moved to the new plan instead of creating a second subscription:

```ts
await authClient.subscription.upgrade({
  plan: "pro",
  successUrl: "/dashboard",
  cancelUrl: "/pricing",
  subscriptionId: "sub_xxx",
})
```

### Schedule change at period end

Use `scheduleAtPeriodEnd: true` (with `returnUrl`) to apply the plan change at the end of the current billing period (no immediate proration; uses Stripe Subscription Schedules).

### Listing subscriptions

```ts
const { data: subscriptions } = await authClient.subscription.list({
  query: { referenceId: "org_123", customerType: "organization" },
})
const active = subscriptions?.find(
  (s) => s.status === "active" || s.status === "trialing"
)
const projectLimit = active?.limits?.projects ?? 0
```

Implement `authorizeReference` in plugin config to authorize who can list/manage subscriptions for a given `referenceId` and `action` (e.g. `list-subscription`, `upgrade-subscription`, `cancel-subscription`, `restore-subscription`).

### Cancel subscription

Redirects user to Stripe Billing Portal:

```ts
await authClient.subscription.cancel({
  referenceId: "org_123",
  subscriptionId: "sub_xxx",
  returnUrl: "/account",
})
```

Cancellation state: `cancelAtPeriodEnd`, `cancelAt`, `canceledAt`, `endedAt`, `status` (only becomes `"canceled"` after the subscription has ended).

### Restore subscription

For subscriptions still active but with pending cancellation or a scheduled plan change (not for already ended subscriptions):

```ts
await authClient.subscription.restore({
  referenceId: "123",
  subscriptionId: "sub_xxx",
})
```

### Billing portal session

```ts
const { data } = await authClient.subscription.billingPortal({
  referenceId: "123",
  returnUrl: "/account",
  locale: "en",
})
// Redirect to data.url
```

## Reference system

- Default: subscription is tied to the **user** (referenceId = user id).
- Use `referenceId` (e.g. organization id) and `customerType: "organization"` to bill by organization.
- For org/team plans, pass `seats` to set quantity. Implement `authorizeReference` so only allowed roles (e.g. owner/admin) can manage that reference.

## Webhooks

The plugin handles `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` with signature verification. For custom logic use `onEvent` in the plugin config.

## Lifecycle hooks

Under `subscription: { ... }` you can use:

- `onSubscriptionComplete` — created via checkout
- `onSubscriptionCreated` — created outside checkout (e.g. Stripe Dashboard)
- `onSubscriptionUpdate`, `onSubscriptionCancel`, `onSubscriptionDeleted`

For trials, plan config supports `freeTrial: { days, onTrialStart, onTrialEnd, onTrialExpired }`. Trial abuse prevention is built-in: one trial per account across all plans.

## Organizations as customers

With the Better Auth organization plugin, set `organization: { enabled: true }` in the Stripe plugin. Then use `customerType: "organization"` and `referenceId: organizationId` when calling `upgrade`, `list`, `cancel`, etc. Implement `authorizeReference` to allow only org owners/admins. Organization billing email is not auto-synced; update via Stripe Dashboard or `stripeClient.customers.update()`.

## Schema (summary)

- **User**: optional `stripeCustomerId`.
- **Organization** (if `organization.enabled`): optional `stripeCustomerId`.
- **Subscription**: `id`, `plan`, `referenceId`, `stripeCustomerId`, `stripeSubscriptionId`, `status`, `periodStart`, `periodEnd`, `cancelAtPeriodEnd`, `cancelAt`, `canceledAt`, `endedAt`, `seats`, `trialStart`, `trialEnd`, `billingInterval`, `stripeScheduleId`, plus plan `limits`. `referenceId` must not be unique (allows resubscribe after cancel).

Use the `schema` option to customize table/field names. Full options and plan config are in [reference.md](reference.md).

## Advanced

- **Checkout customization**: `getCheckoutSessionParams` to set e.g. `allow_promotion_codes`, `tax_id_collection`, `billing_address_collection`, `automatic_tax`, `metadata`, `custom_text`.
- **Local webhook testing**: `stripe listen --forward-to localhost:3000/api/auth/stripe/webhook` and use the printed signing secret for `STRIPE_WEBHOOK_SECRET`.

## Troubleshooting

- **Webhooks**: Confirm URL, signing secret, and required events in Stripe Dashboard; check server logs.
- **Status not updating**: Verify `referenceId` consistency, and that `stripeCustomerId` / `stripeSubscriptionId` are set and webhooks are received.

For full option tables, plan configuration, and schema details, see [reference.md](reference.md). Official docs: https://www.better-auth.com/docs/plugins/stripe.
