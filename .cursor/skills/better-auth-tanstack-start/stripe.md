# Better Auth Stripe Plugin

Use this guide to add Stripe subscriptions and payments to your TanStack Start app.

## 1. Setup

### Installation

```bash
bun add @better-auth/stripe stripe
```

### Environment Variables (`.env`)

```txt
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_... # For client-side Stripe (optional, but good practice)
```

### Server Configuration (`src/auth/auth.server.ts`)

Initialize the Stripe client and add the plugin to your Better Auth instance:

```ts
import { betterAuth } from "better-auth";
import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";
// ... other imports

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia", // Use latest API version
});

export const auth = betterAuth({
  // ... other config
  plugins: [
    stripe({
        stripeClient,
        stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
        createCustomerOnSignUp: true, // Auto-create customer on user signup
        subscription: {
            enabled: true,
            plans: [
                {
                    priceId: "price_...",
                    name: "Pro Plan",
                },
                {
                    priceId: "price_...",
                    name: "Enterprise Plan",
                }
            ]
        }
    }),
    // ... other plugins
  ],
});
```

### Client Configuration (`src/auth/auth-client.ts`)

Add the `stripeClient` plugin:

```ts
import { createAuthClient } from "better-auth/react";
import { stripeClient } from "@better-auth/stripe/client";

export const authClient = createAuthClient({
  // ... other config
  plugins: [
    stripeClient({
        subscription: true,
    }),
    // ... other plugins
  ],
});
```

### Database Migration

Run the Better Auth CLI to generate the new schema for Stripe customers, subscriptions, and products:

```bash
bunx @better-auth/cli generate
bunx drizzle-kit push
```

## 2. Core Features

### Creating a Checkout Session (Subscription)

```ts
const { data, error } = await authClient.subscription.create({
    priceId: "price_123",
    successUrl: "/dashboard",
    cancelUrl: "/pricing",
});
```

### Creating a Customer Portal Session

Redirect users to the Stripe Customer Portal to manage their subscription:

```ts
const { data, error } = await authClient.billing.createPortalSession({
    returnUrl: "/dashboard",
});
```

### Checking Subscription Status (Client)

```ts
import { useSession } from "@/auth/auth-client";

function SubscriptionStatus() {
  const session = useSession();
  const subscription = session.data?.user.subscription; // Requires `subscription` plugin enabled

  if (!subscription) return <div>No active subscription</div>;

  return (
    <div>
      <p>Plan: {subscription.plan}</p>
      <p>Status: {subscription.status}</p>
    </div>
  );
}
```

### Handling Webhooks

Better Auth automatically handles Stripe webhooks at `/api/auth/stripe/webhook`.
Make sure you configure your Stripe Dashboard to send events to `https://your-domain.com/api/auth/stripe/webhook`.

**Required Events:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

## 3. One-Time Payments

If you are handling one-time payments (not subscriptions), you can use the `payment` features:

**Server Config:**
Enable `oneTime` in the plugin options.

**Client Usage:**

```ts
const { data, error } = await authClient.payment.create({
    priceId: "price_one_time_...",
    successUrl: "/success",
    cancelUrl: "/cancel",
});
```

## 4. Troubleshooting

- **Webhook Signature Verification Failed**: Ensure `STRIPE_WEBHOOK_SECRET` matches the secret in your Stripe Dashboard for the specific endpoint.
- **Customer Not Created**: Ensure `createCustomerOnSignUp: true` is set, or manually create customers.
- **Redirect URI Mismatch**: Ensure `BETTER_AUTH_URL` matches your deployed URL.
