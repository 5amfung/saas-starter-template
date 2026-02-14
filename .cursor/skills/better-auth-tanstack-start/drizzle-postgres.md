## Drizzle + Postgres integration

### Adapter setup

Use the Drizzle adapter with Postgres provider:

```ts
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@/db"

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
})
```

### Schema expectations

Better Auth typically needs tables like:

- `user`
- `session`
- `account` (for social providers and password)
- `verification` (for verification flows like email verification / OTP)

In this repo, these live in `src/db/schema.ts`.

### Migrations when enabling plugins

Plugins can add required fields/tables. Prefer using the Better Auth CLI to generate schema updates, then apply with Drizzle Kit:

```bash
npx @better-auth/cli generate
```

Then:

- Review the generated schema output.
- Create/apply Drizzle migrations using your project’s Drizzle workflow.

### Common mistakes

- **Wrong provider**: ensure `provider: "pg"` when using Postgres.
- **Missing tables/columns**: after adding a plugin, regenerate/update schema and migrate.
