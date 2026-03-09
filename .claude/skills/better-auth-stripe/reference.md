# Better Auth Stripe — Reference

Option tables and schema details. Main instructions are in [SKILL.md](SKILL.md). Official docs: https://www.better-auth.com/docs/plugins/stripe.

## Plugin options

| Option | Type | Description |
|--------|------|-------------|
| `stripeClient` | `Stripe` | Stripe client instance. **Required.** |
| `stripeWebhookSecret` | `string` | Webhook signing secret from Stripe. **Required.** |
| `createCustomerOnSignUp` | `boolean` | Create Stripe customer on signup. Default: `false`. |
| `onCustomerCreate` | `function` | Callback after customer created. Receives `{ stripeCustomer, user }` and context. |
| `getCustomerCreateParams` | `function` | Customize Stripe customer create params. Receives `user` and context. |
| `onEvent` | `function` | Callback for any Stripe webhook event. Receives `Stripe.Event`. |
| `subscription` | `object` | Subscription config. See below. |
| `organization` | `object` | Organization-as-customer config. See below. |
| `schema` | `object` | Customize table/field names for Stripe plugin schema. |

## Subscription options

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | `boolean` | Enable subscription functionality. **Required.** |
| `plans` | `StripePlan[]` or `function` | Plans array or async function returning plans. **Required** if enabled. |
| `requireEmailVerification` | `boolean` | Require verified email before upgrade. Default: `false`. |
| `authorizeReference` | `function` | Authorize referenceId. Receives `{ user, session, referenceId, action }` and context. |
| `getCheckoutSessionParams` | `function` | Customize Checkout session. Receives `{ user, session, plan, subscription }`, request, context. |
| `onSubscriptionComplete` | `function` | After subscription created via checkout. |
| `onSubscriptionCreated` | `function` | After subscription created outside checkout. |
| `onSubscriptionUpdate` | `function` | When subscription is updated. |
| `onSubscriptionCancel` | `function` | When subscription is canceled. |
| `onSubscriptionDeleted` | `function` | When subscription is deleted. |

## Plan configuration

| Option | Type | Description |
|--------|------|-------------|
| `name` | `string` | Plan name. **Required.** Stored lowercased. |
| `priceId` | `string` | Stripe price ID. **Required** unless using `lookupKey`. |
| `lookupKey` | `string` | Stripe price lookup key. Alternative to `priceId`. |
| `annualDiscountPriceId` | `string` | Price ID for annual billing. |
| `annualDiscountLookupKey` | `string` | Lookup key for annual billing. |
| `limits` | `object` | App limits (e.g. `{ projects: 10, storage: 5 }`). |
| `group` | `string` | Plan group/category. |
| `seatPriceId` | `string` | Per-seat price ID. Requires organization plugin. |
| `lineItems` | `LineItem[]` | Extra line items in checkout. Same billing interval as main price. |
| `freeTrial` | `object` | Trial config: `days`, `onTrialStart`, `onTrialEnd`, `onTrialExpired`. |

Stripe does not support mixed-interval subscriptions in Checkout; all line items must share the same interval (e.g. all monthly or all yearly).

## Free trial configuration

| Option | Type | Description |
|--------|------|-------------|
| `days` | `number` | Trial length in days. **Required.** |
| `onTrialStart` | `function` | When trial starts. Receives `subscription`. |
| `onTrialEnd` | `function` | When trial ends. Receives `{ subscription }` and context. |
| `onTrialExpired` | `function` | When trial expires without conversion. Receives `subscription` and context. |

## Organization options

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | `boolean` | Enable organization as Stripe customer. **Required.** |
| `getCustomerCreateParams` | `function` | Customize org customer params. Receives `organization` and context. |
| `onCustomerCreate` | `function` | After org customer created. Receives `{ stripeCustomer, organization }` and context. |

## Schema (tables and fields)

### User

- `stripeCustomerId` (string, optional)

### Organization (when `organization.enabled`)

- `stripeCustomerId` (string, optional)

### Subscription

| Field | Type | Key | Description |
|-------|------|-----|-------------|
| `id` | string | pk | Subscription id. |
| `plan` | string | — | Plan name. |
| `referenceId` | string | — | User or org id; must NOT be unique. |
| `stripeCustomerId` | string | — | Stripe customer id. |
| `stripeSubscriptionId` | string | — | Stripe subscription id. |
| `status` | string | — | e.g. active, canceled, trialing. |
| `periodStart` | Date | — | Current period start. |
| `periodEnd` | Date | — | Current period end. |
| `cancelAtPeriodEnd` | boolean | — | Will cancel at period end. |
| `cancelAt` | Date | — | When cancellation takes effect. |
| `canceledAt` | Date | — | When cancellation was requested. |
| `endedAt` | Date | — | When subscription ended. |
| `seats` | number | — | Team seats. |
| `trialStart` | Date | — | Trial start. |
| `trialEnd` | Date | — | Trial end. |
| `billingInterval` | string | — | e.g. month, year. |
| `stripeScheduleId` | string | — | Present when a plan change is scheduled at period end. |

### Customizing schema

```ts
stripe({
  schema: {
    subscription: {
      modelName: "stripeSubscriptions",
      fields: { plan: "planName" },
    },
  },
})
```
