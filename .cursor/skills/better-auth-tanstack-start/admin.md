## Admin plugin

The Admin plugin provides admin-only operations such as listing users, creating users, banning, impersonation, and setting roles.

### Server setup

```ts
import { admin } from "better-auth/plugins"

export const auth = betterAuth({
  plugins: [
    admin({
      adminUserIds: ["user-id-1"],
      impersonationSessionDuration: 60 * 60,
    }),
  ],
})
```

### Client setup

```ts
import { createAuthClient } from "better-auth/react"
import { adminClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  plugins: [adminClient()],
})
```

### Client usage examples

List users (pagination + search):

```ts
const { data } = await authClient.admin.listUsers({
  query: {
    limit: 10,
    offset: 0,
    searchValue: "john",
    searchField: "name",
    sortBy: "createdAt",
    sortDirection: "desc",
  },
})
```

Ban a user:

```ts
await authClient.admin.banUser({
  userId: "user-id",
  banReason: "Violation of terms",
  banExpiresIn: 60 * 60 * 24 * 7,
})
```

Impersonate:

```ts
await authClient.admin.impersonateUser({ userId: "user-id" })
await authClient.admin.stopImpersonating()
```

### Security notes

- Keep admin capabilities behind protected routes/layouts.
- Use `adminUserIds` as the baseline gate; add additional server-side checks if your app needs role-based admin access.
- Treat admin endpoints as privileged; avoid exposing “admin UI” to non-admin users.
