---
title: Last Login Method plugin
description: Add Better Auth Last Login Method plugin (server + client), optional DB persistence, and UI usage patterns.
---

# Better Auth: Last Login Method plugin

Use this when you want to:

- Show UI hints like “Last signed in with Google.”.
- Prefer the user’s most recently used sign-in method.
- Persist `user.lastLoginMethod` in the DB for analytics / server-side logic.

## 1) Server setup

Add the plugin to your Better Auth instance:

```ts
import { lastLoginMethod } from "better-auth/plugins"

plugins: [
  // ...other plugins...
  lastLoginMethod(),
]
```

### Optional: store in database

If you want the method persisted on `user.lastLoginMethod`, enable DB storage:

```ts
lastLoginMethod({
  storeInDatabase: true,
})
```

When `storeInDatabase: true`, the plugin adds a `lastLoginMethod` field to your `user` table (unless you customize it via `schema.user.lastLoginMethod`).

## 2) Client setup

Add the client plugin:

```ts
import { lastLoginMethodClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [
    // ...other client plugins...
    lastLoginMethodClient(),
  ],
})
```

If you customize `cookieName` on the server, pass the same `cookieName` to `lastLoginMethodClient({ cookieName })`.

## 3) Use it in UI

The client plugin exposes helpers:

```ts
const lastMethod = authClient.getLastUsedLoginMethod()
const wasGoogle = authClient.isLastUsedLoginMethod("google")
authClient.clearLastUsedLoginMethod()
```

Typical sign-in UI pattern:

- Highlight the button whose provider matches `getLastUsedLoginMethod()`.

## 4) Migrations + Drizzle schema (when DB persistence is enabled)

Run the Better Auth CLI migrations (Bun-first):

```bash
bunx @better-auth/cli migrate
bunx @better-auth/cli generate
```

If you don’t use Bun, the upstream docs use:

```bash
npx @better-auth/cli migrate
npx @better-auth/cli generate
```

Then ensure your Drizzle `user` table model includes the new column:

- Update `src/db/schema.ts` to include `lastLoginMethod` (or your custom column name).
- Apply/commit the generated migration artifacts per your project’s Drizzle workflow.

## Notes / gotchas

- The cookie is `httpOnly: false` so the client can read it for UI. Consider consent requirements if your app needs them.
- For custom auth flows/providers, use `customResolveMethod(ctx)` to return a stable method string (or return `null` to fall back to default detection).

