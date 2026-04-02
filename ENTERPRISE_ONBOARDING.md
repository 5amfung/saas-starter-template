# Enterprise Customer Onboarding Guide

This guide covers the end-to-end workflows for provisioning, upgrading, and offboarding enterprise customers. Intended for ops — no code changes required.

---

## 1. Stripe Setup (One-Time)

Before onboarding any enterprise customer, create the $0 enterprise product in Stripe. This only needs to be done once per environment (staging, production).

1. Go to **Stripe Dashboard → Products**.
2. Click **Add product** and name it `Enterprise Plan`.
3. Add a recurring price of **$0/month** (or $0/year, depending on your billing cadence preference).
4. Copy the generated **Price ID** (e.g., `price_xxx`).
5. Set the environment variable in the web app's `.env`:
   ```
   STRIPE_ENTERPRISE_PRICE_ID=price_xxx
   ```
6. Deploy or restart the app to pick up the new environment variable.

> ⚠️ This $0 price exists purely for plan identity. It signals to the system that a workspace is on the enterprise plan. Actual contract billing is handled separately via manual invoices or scheduled invoices — not through this subscription.

---

## 2. Standard Enterprise Deal (No Custom Limits)

Use this workflow for enterprise customers who receive the default unlimited entitlements with no negotiated caps.

**Prerequisites:** The customer must have already signed up and have a workspace in the system.

1. In **Stripe Dashboard**, find or create the customer record (match by email).
2. Navigate to the customer's **Subscriptions** tab.
3. Click **Create subscription**.
4. Select the **Enterprise Plan** product and the **$0 price** created in Step 1.
5. Confirm and activate the subscription.
6. The Better Auth Stripe webhook fires automatically and writes `subscription.plan = 'enterprise'` to the workspace.
7. Done — the workspace now has full enterprise entitlements (unlimited members, unlimited storage, all features enabled).

> ⚠️ Confirm the webhook delivered successfully in the Stripe Dashboard under **Developers → Webhooks → Recent deliveries**. If it failed, use the "Resend" button to retry.

---

## 3. Custom Enterprise Deal (Negotiated Limits)

Use this workflow when a contract specifies custom resource caps (e.g., 500 seats, 1TB storage).

1. Complete **all steps in Section 2** (Standard Enterprise Deal) first.
2. Open the **admin panel** (runs on port 3001 in development, or your deployed admin URL).
3. Navigate to **Workspaces** and find the customer's workspace by name or ID.
4. Locate the **Entitlement Overrides** section. This section only appears for workspaces on the enterprise plan.
5. Enter custom limits for any fields specified in the contract:
   - **Members:** e.g., `500`
   - **Storage:** e.g., `1000` (in GB)
   - Leave any field **blank** to inherit the enterprise default (unlimited).
6. Add a **note** with contract context for future reference. Example:
   ```
   Acme Corp — Contract #1234, 500 seats, signed 2026-01-15
   ```
7. Click **Save Overrides**.

> ⚠️ Always add a note. Overrides without contract context make future audits difficult.

---

## 4. Self-Serve to Enterprise Upgrade

When a customer on a paid self-serve plan (starter, pro, etc.) upgrades to enterprise.

> ⚠️ **IMPORTANT: Cancel the self-serve subscription BEFORE creating the enterprise subscription.** If both subscriptions coexist, billing UI actions (cancel, reactivate, downgrade) will target the highest-tier subscription (enterprise), making the self-serve subscription unreachable through normal UI flows. This creates billing inconsistencies that are difficult to untangle.

1. In **Stripe Dashboard**, open the customer's existing self-serve subscription.
2. **Cancel** the self-serve subscription immediately (not at period end, unless required by contract).
3. Confirm the cancellation webhook delivered and the workspace plan has downgraded.
4. Create the enterprise subscription per **Section 2** (Standard Enterprise Deal).
5. If negotiated limits apply, configure overrides per **Section 3** (Custom Enterprise Deal).

---

## 5. Enterprise Downgrade (Customer Churn)

When an enterprise customer's contract ends or they churn.

1. In **Stripe Dashboard**, cancel the enterprise Stripe subscription.
2. The webhook fires automatically and updates the subscription status.
3. The system's `resolveWorkspacePlanId()` function falls back to the next active subscription, or to the free plan if none exists.
4. The entitlement override row in the database becomes inert — overrides are only consulted when the workspace plan is `enterprise`, so they have no effect on a free or self-serve plan.
5. **Member access after downgrade:** Existing members retain access, but new invites are blocked once the workspace exceeds the free plan's member cap.

> ⚠️ Communicate the member cap restriction to the customer before downgrade if their workspace is near or over the free tier limit. Members are not automatically removed — only new additions are blocked.

---

## 6. Billing Actual Contract Amounts

The $0 enterprise subscription handles **plan identity only** — it does not bill the customer. Contract amounts must be invoiced separately.

**Options for billing:**

- **Manual invoices:** In Stripe Dashboard, create a one-time invoice for the customer with the contracted amount and send it directly.
- **Scheduled invoices:** Use Stripe's invoice scheduling to set up recurring contract payments (monthly, quarterly, or annual) independent of the $0 subscription.

The subscription and invoices are fully independent objects in Stripe. The subscription controls what the customer can do inside the product; invoices control what they pay. Neither affects the other.
