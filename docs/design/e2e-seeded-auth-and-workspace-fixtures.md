# E2E Seeded Auth And Workspace Fixtures

This note explains how the seeded E2E helpers work today in `apps/web` and `packages/test-utils`.

Key files:

- [`packages/test-utils/src/e2e-auth.ts`](/Users/sfung/.codex/worktrees/a718/sass-starter-template/packages/test-utils/src/e2e-auth.ts)
- [`packages/test-utils/src/seeded-user.ts`](/Users/sfung/.codex/worktrees/a718/sass-starter-template/packages/test-utils/src/seeded-user.ts)
- [`packages/test-utils/src/isolated-workspace.ts`](/Users/sfung/.codex/worktrees/a718/sass-starter-template/packages/test-utils/src/isolated-workspace.ts)
- [`packages/test-utils/src/e2e-db.ts`](/Users/sfung/.codex/worktrees/a718/sass-starter-template/packages/test-utils/src/e2e-db.ts)
- [`apps/web/test/e2e/workspace/settings.spec.ts`](/Users/sfung/.codex/worktrees/a718/sass-starter-template/apps/web/test/e2e/workspace/settings.spec.ts)
- [`apps/web/test/e2e/workspace/members.spec.ts`](/Users/sfung/.codex/worktrees/a718/sass-starter-template/apps/web/test/e2e/workspace/members.spec.ts)

## Main Idea

The helpers seed durable auth/workspace rows directly in Postgres, but they still ask Better Auth to issue the real session cookie. That keeps tests fast without hardcoding session internals.

For non-billing workspace flows, paid entitlements can also be seeded directly by inserting a `subscription` row. Live Stripe checkout remains covered in `billing.spec.ts`, where billing behavior itself is under test.

## Normal Isolated Workspace Flow

```mermaid
sequenceDiagram
    participant Test as "Playwright test"
    participant Fixture as "createIsolatedWorkspaceFixture()"
    participant SeedUser as "createSeededUser()"
    participant Crypto as "better-auth hashPassword()"
    participant DB as "Postgres via getE2EDb()"
    participant Auth as "signInSeededUser()"
    participant BA as "Better Auth"
    participant Browser as "Playwright browser context"

    Test->>Fixture: createIsolatedWorkspaceFixture(baseUrl, owner opts)
    Fixture->>SeedUser: createSeededUser(baseUrl, { email, password, name })

    SeedUser->>Crypto: hashPassword(password)
    Crypto-->>SeedUser: passwordHash

    SeedUser->>DB: insert user
    SeedUser->>DB: insert account(providerId='credential')
    SeedUser->>DB: insert organization
    SeedUser->>DB: insert member(role='owner')

    SeedUser->>Auth: signInSeededUser(baseUrl, { email, password })
    Auth->>BA: POST /api/auth/sign-in/email
    BA-->>Auth: Set-Cookie session
    Auth-->>SeedUser: cookie

    SeedUser-->>Fixture: { userId, workspaceId, cookie }
    Fixture-->>Test: fixture { owner, workspaceId, workspace }

    Test->>Browser: addCookies(parseCookieHeader(cookie))
    Test->>Browser: goto /ws/:workspaceId/...
```

## `signInSeededUser()` Flow

```mermaid
sequenceDiagram
    participant Caller as "Helper or test"
    participant SignIn as "signInSeededUser()"
    participant Auth as "POST /api/auth/sign-in/email"
    participant BA as "Better Auth"

    Caller->>SignIn: signInSeededUser(baseUrl, { email, password })
    SignIn->>Auth: fetch JSON credentials
    Auth->>BA: verify seeded credential account
    BA-->>Auth: Set-Cookie session
    Auth-->>SignIn: HTTP response
    SignIn-->>Caller: { cookie }
```

## Paid Workspace Extension

This is used when a test needs paid-plan behavior but is not testing checkout itself.

```mermaid
sequenceDiagram
    participant Test as "Playwright test"
    participant Fixture as "createIsolatedWorkspaceFixture(plan)"
    participant Plan as "ensureWorkspaceSubscription()"
    participant DB as "Postgres via getE2EDb()"

    Test->>Fixture: createIsolatedWorkspaceFixture(..., { plan: 'starter' })
    Fixture->>Plan: ensureWorkspaceSubscription(workspaceId, 'starter')
    Plan->>DB: query subscription rows
    alt subscription already exists
        DB-->>Plan: existing row
        Plan-->>Fixture: no-op
    else no subscription
        Plan->>DB: insert subscription(plan, referenceId, status='active')
        DB-->>Plan: inserted
    end
    Fixture-->>Test: paid workspace fixture
```

## Invite Flow In Members Or Settings Tests

```mermaid
sequenceDiagram
    participant Test as "Workspace test"
    participant Owner as "createIsolatedWorkspaceFixture()"
    participant Invitee as "createSeededUser()"
    participant Plan as "ensureWorkspaceSubscription()"
    participant UI as "Members page UI"
    participant Mail as "waitForTestEmail()"
    participant API as "acceptInvitationViaApi()"
    participant BA as "Better Auth"

    Test->>Owner: create owner workspace fixture
    Test->>Invitee: create seeded invitee user
    Test->>Plan: ensure workspace has starter subscription

    Test->>UI: goto /ws/:id/members
    Test->>UI: send invitation
    UI-->>Mail: invitation email emitted

    Test->>Mail: read invitation URL and id
    Test->>API: sign in invitee via /api/auth/sign-in/email
    API->>BA: authenticate invitee
    BA-->>API: invitee session cookie
    Test->>API: POST /api/auth/organization/accept-invitation
    API-->>Test: invitation accepted

    Test->>UI: reload workspace page
    UI-->>Test: role-based state visible
```

## Practical Rules

- Use `createIsolatedWorkspaceFixture()` when a test needs a private workspace.
- Use `createIsolatedWorkspaceFixture({ plan: 'starter' | 'pro' })` when a non-billing spec needs paid entitlements.
- Use `createSeededUser()` for additional users that should exist without real sign-up.
- Use `signInSeededUser()` when you want Better Auth to mint a real session cookie from seeded credentials.
- Keep live Stripe checkout in billing-focused tests rather than using it as generic workspace setup.
