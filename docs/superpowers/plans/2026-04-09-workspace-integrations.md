# SF-33 Workspace Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new workspace `Integrations` section with paid-plan owner/admin gating, encrypted workspace-owned Slack credentials, and masked reveal/edit behavior that is structured for future integrations.

**Architecture:** Extend the shared workspace capability model with integration-specific flags, persist secrets in a new generic app-schema table keyed by workspace/integration/field, and keep crypto plus secret access in server-only helpers. Build a new `apps/web` route that renders a Slack-specific card using reusable field-row behavior while relying on server functions for masked reads, reveal, and save actions.

**Tech Stack:** TanStack Start server functions, TanStack Router, TanStack Query, TanStack Form, Drizzle ORM, Neon Postgres, Node `crypto`, Vitest, Testing Library

---

### Task 1: Add integration capabilities to the shared workspace policy

**Files:**

- Modify: `packages/policy/src/workspace.ts`
- Modify: `packages/policy/test/unit/workspace.test.ts`
- Reference: `apps/web/src/policy/workspace-capabilities.server.ts`

- [x] **Step 1: Add failing capability tests for paid-plan owner/admin access**

In `packages/policy/test/unit/workspace.test.ts`, add coverage for the new flags with cases like:

```ts
it('allows integrations for paid-plan owners', () => {
  expect(
    evaluateWorkspaceCapabilities({
      workspaceRole: 'owner',
      isLastWorkspace: false,
      hasActivePaidPlan: true,
    })
  ).toMatchObject({
    canViewIntegrations: true,
    canManageIntegrations: true,
  });
});

it('denies integrations for free-plan admins', () => {
  expect(
    evaluateWorkspaceCapabilities({
      workspaceRole: 'admin',
      isLastWorkspace: false,
      hasActivePaidPlan: false,
    })
  ).toMatchObject({
    canViewIntegrations: false,
    canManageIntegrations: false,
  });
});

it('denies integrations for paid-plan members', () => {
  expect(
    evaluateWorkspaceCapabilities({
      workspaceRole: 'member',
      isLastWorkspace: false,
      hasActivePaidPlan: true,
    })
  ).toMatchObject({
    canViewIntegrations: false,
    canManageIntegrations: false,
  });
});
```

- [x] **Step 2: Run the policy test target to verify it fails**

Run:

```bash
pnpm --filter @workspace/policy test -- test/unit/workspace.test.ts
```

Expected: FAIL because `WorkspaceCapabilities` and `evaluateWorkspaceCapabilities` do not yet define `canViewIntegrations` or `canManageIntegrations`.

- [x] **Step 3: Implement the capability flags in the policy model**

In `packages/policy/src/workspace.ts`, extend the capability surface and evaluation logic. Keep naming aligned with the spec:

```ts
export type WorkspaceCapabilities = {
  canViewBilling: boolean;
  canViewMembers: boolean;
  canInviteMembers: boolean;
  canManageMembers: boolean;
  canViewSettings: boolean;
  canManageSettings: boolean;
  canViewIntegrations: boolean;
  canManageIntegrations: boolean;
  workspaceRole: WorkspaceRole | null;
};
```

Set both integration flags to `true` only when:

```ts
const canAccessIntegrations =
  hasActivePaidPlan && (workspaceRole === 'owner' || workspaceRole === 'admin');
```

and then return:

```ts
canViewIntegrations: canAccessIntegrations,
canManageIntegrations: canAccessIntegrations,
```

- [x] **Step 4: Re-run the policy tests**

Run:

```bash
pnpm --filter @workspace/policy test -- test/unit/workspace.test.ts
```

Expected: PASS with the new integration-capability cases.

- [x] **Step 5: Commit the policy change**

```bash
git add packages/policy/src/workspace.ts packages/policy/test/unit/workspace.test.ts
git commit -m "feat(policy): add workspace integration capabilities"
```

### Task 2: Add the generic encrypted workspace-integration table

**Files:**

- Modify: `packages/db-schema/src/app.schema.ts`
- Modify: `packages/db-schema/src/schema.ts`
- Create: `packages/db-schema/drizzle/XXXX_workspace_integration_secret.sql`
- Modify: `packages/db-schema/test/...` relevant schema or integration coverage file if one exists for app tables
- Reference: `packages/db-schema/src/auth.schema.ts`

- [x] **Step 1: Add a failing schema test or snapshot assertion**

If there is an existing schema-level test file for app tables, add an assertion that the exported schema includes a `workspaceIntegrationSecret` table with the expected columns:

```ts
expect(schema.workspaceIntegrationSecret).toBeDefined();
expect(Object.keys(schema.workspaceIntegrationSecret)).toEqual(
  expect.arrayContaining([
    'id',
    'workspaceId',
    'integration',
    'key',
    'encryptedValue',
    'iv',
    'authTag',
    'encryptionVersion',
    'createdAt',
    'updatedAt',
  ])
);
```

If there is no meaningful existing schema test, use the migration-generation step below as the failing checkpoint and note that schema verification is done via Drizzle output.

- [x] **Step 2: Add the table definition to the app schema**

In `packages/db-schema/src/app.schema.ts`, add a new table and relation using the existing naming conventions:

```ts
export const workspaceIntegrationSecrets = pgTable(
  'workspace_integration_secret',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    integration: text('integration').notNull(),
    key: text('key').notNull(),
    encryptedValue: text('encrypted_value').notNull(),
    iv: text('iv').notNull(),
    authTag: text('auth_tag').notNull(),
    encryptionVersion: integer('encryption_version').notNull().default(1),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('workspace_integration_secret_workspace_key_uidx').on(
      table.workspaceId,
      table.integration,
      table.key
    ),
  ]
);
```

Also export it from `packages/db-schema/src/schema.ts`.

- [x] **Step 3: Generate the migration**

Run:

```bash
pnpm --filter @workspace/db-schema db:generate
```

Expected: A new SQL migration appears under `packages/db-schema/drizzle/` creating the `workspace_integration_secret` table with the unique index and foreign key.

- [x] **Step 4: Inspect the generated migration**

Verify the generated SQL includes:

```sql
CREATE TABLE "workspace_integration_secret" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "integration" text NOT NULL,
  "key" text NOT NULL,
  "encrypted_value" text NOT NULL,
  "iv" text NOT NULL,
  "auth_tag" text NOT NULL,
  "encryption_version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
```

and a unique index over `workspace_id`, `integration`, and `key`.

- [x] **Step 5: Commit the schema change**

```bash
git add packages/db-schema/src/app.schema.ts packages/db-schema/src/schema.ts packages/db-schema/drizzle
git commit -m "feat(db-schema): add workspace integration secrets table"
```

### Task 3: Build server-only crypto and integration secret accessors

**Files:**

- Create: `apps/web/src/integrations/integration-crypto.server.ts`
- Create: `apps/web/src/integrations/integration-definitions.ts`
- Create: `apps/web/src/integrations/integration-secrets.server.ts`
- Create: `apps/web/src/integrations/integration-secrets.functions.ts`
- Modify: `apps/web/src/init.ts` only if new runtime wiring is required
- Create: `apps/web/test/unit/integrations/integration-crypto.server.test.ts`
- Create: `apps/web/test/unit/integrations/integration-secrets.server.test.ts`
- Reference: `apps/web/src/workspace/workspace-settings.functions.ts`
- Reference: `apps/web/src/billing/billing.functions.ts`

- [x] **Step 1: Add failing crypto helper tests**

Create `apps/web/test/unit/integrations/integration-crypto.server.test.ts` with focused coverage:

```ts
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  maskIntegrationSecret,
} from '@/integrations/integration-crypto.server';

describe('integration crypto', () => {
  it('round-trips plaintext through AES-256-GCM', () => {
    const encrypted = encryptIntegrationSecret('xoxb-slack-secret');

    expect(encrypted.encryptedValue).not.toBe('xoxb-slack-secret');
    expect(decryptIntegrationSecret(encrypted)).toBe('xoxb-slack-secret');
  });

  it('masks all but the first six characters', () => {
    expect(maskIntegrationSecret('ro_ad8secret')).toBe('ro_ad8******');
  });
});
```

- [x] **Step 2: Add failing server helper tests for authorization-safe data shape**

Create `apps/web/test/unit/integrations/integration-secrets.server.test.ts` with assertions like:

```ts
it('returns masked Slack values without plaintext', async () => {
  const result = await getWorkspaceIntegrationSummaries(headers, 'ws_123');

  expect(result).toEqual([
    expect.objectContaining({
      integration: 'slack',
      fields: expect.arrayContaining([
        expect.objectContaining({
          key: 'clientId',
          hasValue: true,
          maskedValue: expect.stringMatching(/^.{6}\*+$/),
        }),
      ]),
    }),
  ]);
});
```

Mock database access and permission checks so the first run fails because the modules do not exist yet.

- [x] **Step 3: Implement the crypto helper**

In `apps/web/src/integrations/integration-crypto.server.ts`, add a server-only helper around Node `crypto`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ENCRYPTION_VERSION = 1;

function getIntegrationEncryptionKey() {
  const raw = process.env.WORKSPACE_SECRET_ENCRYPTION_KEY;
  if (!raw) throw new Error('WORKSPACE_SECRET_ENCRYPTION_KEY is required.');

  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('WORKSPACE_SECRET_ENCRYPTION_KEY must decode to 32 bytes.');
  }

  return key;
}
```

Expose:

```ts
export function encryptIntegrationSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    'aes-256-gcm',
    getIntegrationEncryptionKey(),
    iv
  );
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedValue: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    encryptionVersion: ENCRYPTION_VERSION,
  };
}
```

and matching decrypt/mask helpers.

- [x] **Step 4: Implement integration definitions and server accessors**

In `apps/web/src/integrations/integration-definitions.ts`, define the initial Slack metadata:

```ts
export const INTEGRATION_DEFINITIONS = {
  slack: {
    label: 'Slack',
    fields: [
      { key: 'clientId', label: 'Client ID', secret: true },
      { key: 'clientSecret', label: 'Client Secret', secret: true },
    ],
  },
} as const;
```

In `apps/web/src/integrations/integration-secrets.server.ts`, add helpers to:

- list saved rows for a workspace
- map saved rows into integration summaries with `hasValue` and `maskedValue`
- reveal one field by decrypting one row
- upsert one changed field by encrypting before write
- delete a row when a field is intentionally cleared

Use existing workspace capability checks:

```ts
await requireWorkspaceCapabilityForUser(
  headers,
  workspaceId,
  session.user.id,
  'canViewIntegrations'
);
```

for summaries, and `canManageIntegrations` for reveal/save.

- [x] **Step 5: Expose server functions and run focused tests**

In `apps/web/src/integrations/integration-secrets.functions.ts`, wrap the server helpers with `createServerFn()` input validators for:

- `getWorkspaceIntegrations`
- `revealWorkspaceIntegrationValue`
- `updateWorkspaceIntegrationValues`

Run:

```bash
pnpm --filter @workspace/web test -- test/unit/integrations/integration-crypto.server.test.ts test/unit/integrations/integration-secrets.server.test.ts
```

Expected: PASS with encryption, masking, and display-safe summary coverage.

- [x] **Step 6: Commit the server integration foundation**

```bash
git add apps/web/src/integrations apps/web/test/unit/integrations
git commit -m "feat(web): add encrypted workspace integration secret helpers"
```

### Task 4: Add the integrations route, sidebar entry, and Slack UI

**Files:**

- Modify: `apps/web/src/components/app-sidebar.tsx`
- Create: `apps/web/src/routes/_protected/ws/$workspaceId/integrations.tsx`
- Create: `apps/web/src/components/integrations/integration-card.tsx`
- Create: `apps/web/src/components/integrations/integration-secret-field-row.tsx`
- Create: `apps/web/test/integration/routes/workspace-integrations-page.integration.test.tsx`
- Reference: `apps/web/src/routes/_protected/ws/$workspaceId/settings.tsx`

- [x] **Step 1: Add failing route/UI tests**

Create `apps/web/test/integration/routes/workspace-integrations-page.integration.test.tsx` with cases like:

```tsx
it('hides the navigation item when the user cannot view integrations', () => {
  renderWithProviders(<AppSidebar />);

  expect(
    screen.queryByRole('link', { name: /integrations/i })
  ).not.toBeInTheDocument();
});

it('disables save until a revealed Slack field changes', async () => {
  renderRoute('/ws/ws_123/integrations');

  const saveButton = await screen.findByRole('button', {
    name: /save client id/i,
  });
  expect(saveButton).toBeDisabled();
});
```

Also add a route-loader authorization test expecting `notFound` when `canViewIntegrations` is false.

- [x] **Step 2: Add the sidebar entry**

In `apps/web/src/components/app-sidebar.tsx`, insert:

```tsx
...(activeWorkspaceCapabilities?.canViewIntegrations
  ? [
      {
        title: 'Integrations',
        url: `/ws/${activeWorkspaceId}/integrations`,
        icon: <IconPlugConnected />,
      },
    ]
  : []),
```

between the `Members` and `Billing` items, using the closest existing Tabler icon already available in the dependency set.

- [x] **Step 3: Build the route and page shell**

Create `apps/web/src/routes/_protected/ws/$workspaceId/integrations.tsx` following the same route style as other workspace pages:

```tsx
export const Route = createFileRoute(
  '/_protected/ws/$workspaceId/integrations'
)({
  loader: async ({ params }) => {
    const capabilities = await getWorkspaceCapabilities({
      data: { workspaceId: params.workspaceId },
    });

    if (!capabilities.canViewIntegrations) {
      throw notFound({ routeId: '__root__' });
    }

    return {
      capabilities,
      integrations: await getWorkspaceIntegrations({
        data: { workspaceId: params.workspaceId },
      }),
    };
  },
  component: WorkspaceIntegrationsPage,
  staticData: { title: 'Integrations' },
});
```

Use the same centered page layout class pattern as settings.

- [x] **Step 4: Build the Slack card and reusable field-row UI**

Create `apps/web/src/components/integrations/integration-card.tsx` and `apps/web/src/components/integrations/integration-secret-field-row.tsx`.

The field row should own:

- masked default display
- one-field reveal flow
- local edit state
- dirty tracking
- `Save` disabled until changed
- `Cancel` restoring the saved masked state

Shape the component around props similar to:

```ts
type IntegrationSecretFieldRowProps = {
  workspaceId: string;
  integration: 'slack';
  fieldKey: string;
  label: string;
  maskedValue: string | null;
  hasValue: boolean;
  canManage: boolean;
};
```

When `Save` succeeds, reset local state to the new masked saved value returned from the server.

- [x] **Step 5: Run the focused route/UI tests**

Run:

```bash
pnpm --filter @workspace/web test -- test/integration/routes/workspace-integrations-page.integration.test.tsx
```

Expected: PASS with nav visibility, route gating, reveal, dirty-save, and cancel-remask behavior covered.

- [x] **Step 6: Commit the route and UI work**

```bash
git add apps/web/src/components/app-sidebar.tsx apps/web/src/routes/_protected/ws/$workspaceId/integrations.tsx apps/web/src/components/integrations apps/web/test/integration/routes/workspace-integrations-page.integration.test.tsx
git commit -m "feat(web): add workspace integrations page"
```

### Task 5: Run cross-cutting verification and close the loop

**Files:**

- Verify: `packages/policy/src/workspace.ts`
- Verify: `packages/db-schema/src/app.schema.ts`
- Verify: `apps/web/src/integrations/*`
- Verify: `apps/web/src/routes/_protected/ws/$workspaceId/integrations.tsx`
- Verify: `apps/web/src/components/app-sidebar.tsx`

- [x] **Step 1: Run the focused test suites together**

Run:

```bash
pnpm --filter @workspace/policy test -- test/unit/workspace.test.ts
pnpm --filter @workspace/web test -- test/unit/integrations/integration-crypto.server.test.ts test/unit/integrations/integration-secrets.server.test.ts test/integration/routes/workspace-integrations-page.integration.test.tsx
```

Expected: PASS across policy, crypto, server helpers, and route/UI behavior.

- [x] **Step 2: Run type and boundary checks for affected surfaces**

Run:

```bash
pnpm run typecheck
pnpm run check:boundaries
```

Expected: PASS with no new package-boundary or typing regressions.

- [x] **Step 3: Verify migration generation is in sync**

Run:

```bash
pnpm --filter @workspace/db-schema db:generate
git diff --exit-code packages/db-schema/drizzle packages/db-schema/src/app.schema.ts packages/db-schema/src/schema.ts
```

Expected: no diff after regeneration, confirming the checked-in migration matches the current schema.

- [x] **Step 4: Summarize manual sanity checks**

Record that the implemented feature was sanity-checked for:

- nav item ordering: `Members` -> `Integrations` -> `Billing`
- free-plan gating hides access
- paid owner/admin access works
- masked values never appear as plaintext on initial load
- reveal is explicit and field-scoped

- [x] **Step 5: Commit any final verification-related adjustments**

```bash
git add .
git commit -m "test(web): verify workspace integrations flow"
```
