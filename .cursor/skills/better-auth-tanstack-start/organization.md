# Better Auth Organization Plugin

Use this guide to add multi-tenant organization support to your TanStack Start app.

## 1. Setup

### Server Configuration (`src/auth/auth.server.ts`)

Add the `organization` plugin to your Better Auth instance:

```ts
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
// ... imports

export const auth = betterAuth({
  // ... other config
  plugins: [
    organization({
        async sendInvitationEmail(data) {
            // Implement email sending here (e.g. via Resend)
            // data.email, data.inviter.email, data.organization.name, data.url
        }
    }),
    // ... other plugins
  ],
});
```

### Client Configuration (`src/auth/auth-client.ts`)

Add the `organizationClient` plugin:

```ts
import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  // ... other config
  plugins: [
    organizationClient(),
    // ... other plugins
  ],
});
```

### Database Migration

Run the Better Auth CLI to generate the new schema for organizations, members, and invitations:

```bash
bunx @better-auth/cli generate
bunx drizzle-kit push
```

## 2. Core Features

### Creating an Organization

```ts
const { data, error } = await authClient.organization.create({
  name: "My Team",
  slug: "my-team", // optional
});
```

### Managing Members

**Invite a member:**

```ts
const { data, error } = await authClient.organization.inviteMember({
  email: "colleague@example.com",
  role: "member", // or "admin", "owner"
});
```

**Accept an invitation:**
The user clicks the link in the email (which points to a route handling the token).

```ts
const { data, error } = await authClient.organization.acceptInvitation({
  invitationId: "...",
});
```

### Switching Organizations

```ts
const { data, error } = await authClient.organization.setActive({
  organizationId: "org_123",
});
```

### Checking Active Organization (Client)

```ts
import { useSession } from "@/auth/auth-client";

function OrganizationSwitcher() {
  const session = useSession();
  const activeOrg = session.data?.activeOrganization; // null if personal context

  // List all organizations
  const { data: orgs } = authClient.useListOrganizations();

  return (
    // ... UI to switch
  );
}
```

## 3. Route Protection (Middleware)

To protect routes that require an active organization, add a check in your middleware or server function.

**Middleware (`src/middleware/auth.ts`):**

```ts
import { createMiddleware } from "@tanstack/start";
import { auth } from "@/auth/auth.server";
import { getWebRequest } from "@tanstack/start/server";

export const orgMiddleware = createMiddleware().server(async ({ next }) => {
  const request = getWebRequest();
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.session.activeOrganizationId) {
    // Redirect to organization selection or home
    throw redirect({ to: "/dashboard/select-org" });
  }

  return next({ context: { session } });
});
```

## 4. Permissions (RBAC)

You can check permissions on the server or client.

**Server-side:**

```ts
const hasPermission = await auth.api.hasPermission({
  headers: request.headers,
  body: {
    permission: {
      resource: "project",
      action: "create",
    },
  },
});
```

**Client-side:**

```ts
const { data: hasPermission } = authClient.usePermission({
  resource: "project",
  action: "create",
});
```

(Note: You need to configure `ac` (access control) in the organization plugin options to define these resources and actions).
