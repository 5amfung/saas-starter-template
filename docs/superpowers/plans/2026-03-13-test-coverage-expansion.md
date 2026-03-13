# Test Coverage Expansion Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand test coverage from ~53% to ~80%+ across business-critical paths, UI components, and shared infrastructure.

**Architecture:** Risk-driven three-phase approach. Phase 1 builds shared test infrastructure + tests for critical paths (middleware, auth forms). Phase 2 covers core UI components + remaining server logic. Phase 3 covers hooks, email templates, and edge cases. Each task is self-contained with its own commit.

**Tech Stack:** Vitest 4, @testing-library/react 16, jsdom 28, TanStack Form/Router/Query, Zod v4, Better Auth, Drizzle ORM

**Spec:** `docs/superpowers/specs/2026-03-13-test-coverage-expansion-design.md`

---

## Chunk 1: Shared Test Infrastructure (Phase 1.1)

### Task 1: Update Vitest config for jsdom environment

**Files:**

- Modify: `vitest.config.ts`

- [ ] **Step 1: Update vitest.config.ts with environmentMatchGlobs**

```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    environmentMatchGlobs: [
      ['src/**/*.test.tsx', 'jsdom'],
      ['src/hooks/**/*.test.ts', 'jsdom'],
    ],
  },
});
```

- [ ] **Step 2: Run existing tests to verify no regressions**

Run: `pnpm test`
Expected: All 15 existing test files pass.

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "test(config): add jsdom environment for component and hook tests"
```

---

### Task 2: Create mock data factories

**Files:**

- Create: `src/test/factories.ts`

- [ ] **Step 1: Create factories with override merging**

```ts
// src/test/factories.ts

interface MockUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  banned: boolean;
  banReason: string | null;
  banExpires: number | null;
}

interface MockSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  activeOrganizationId: string | null;
}

interface MockSessionResponse {
  user: MockUser;
  session: MockSession;
}

interface MockWorkspace {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  metadata: string | null;
  createdAt: Date;
  workspaceType: 'personal' | 'workspace';
  personalOwnerUserId: string | null;
}

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    image: null,
    role: 'user',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    banned: false,
    banReason: null,
    banExpires: null,
    ...overrides,
  };
}

export function createMockSession(
  overrides: Partial<MockSession> = {},
): MockSession {
  return {
    id: 'session-1',
    userId: 'user-1',
    token: 'test-token',
    expiresAt: new Date('2026-12-31'),
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    activeOrganizationId: 'ws-1',
    ...overrides,
  };
}

export function createMockSessionResponse(
  userOverrides: Partial<MockUser> = {},
  sessionOverrides: Partial<MockSession> = {},
): MockSessionResponse {
  return {
    user: createMockUser(userOverrides),
    session: createMockSession(sessionOverrides),
  };
}

export function createMockWorkspace(
  overrides: Partial<MockWorkspace> = {},
): MockWorkspace {
  return {
    id: 'ws-1',
    name: 'Test Workspace',
    slug: 'test-workspace',
    logo: null,
    metadata: null,
    createdAt: new Date('2025-01-01'),
    workspaceType: 'workspace',
    personalOwnerUserId: null,
    ...overrides,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/test/factories.ts
git commit -m "test(infra): add mock data factories with override merging"
```

---

### Task 3: Create shared DB mock helpers

**Files:**

- Create: `src/test/mocks/db.ts`
- Modify: `src/billing/billing.server.test.ts` (extract `mockDbChain`)

- [ ] **Step 1: Create shared DB mock helper**

```ts
// src/test/mocks/db.ts

/**
 * Creates a chainable mock for Drizzle ORM's `db.select().from().where().limit()` pattern.
 * The chain resolves at `.limit()` — all queries using this helper must end with `.limit()`.
 * For queries that end with `.from()` (no where/limit), mock `.from()` directly.
 *
 * Usage:
 *   const { dbSelectMock } = vi.hoisted(() => ({ dbSelectMock: vi.fn() }));
 *   vi.mock('@/db', () => ({ db: { select: dbSelectMock } }));
 *
 *   // In test:
 *   const { fromMock, whereMock, limitMock } = mockDbChain(dbSelectMock, [{ id: '1' }]);
 */
export function mockDbChain(
  dbSelectMock: ReturnType<typeof vi.fn>,
  result: Array<unknown>,
) {
  const limitMock = vi.fn().mockResolvedValue(result);
  const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  dbSelectMock.mockReturnValue({ from: fromMock });
  return { fromMock, whereMock, limitMock };
}

/**
 * Creates a chainable mock for Drizzle ORM's `db.insert().values().onConflictDoUpdate()` pattern.
 */
export function mockDbInsertChain(
  dbInsertMock: ReturnType<typeof vi.fn>,
  result: Array<unknown> = [],
) {
  const onConflictDoUpdateMock = vi.fn().mockResolvedValue(result);
  const valuesMock = vi
    .fn()
    .mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
  dbInsertMock.mockReturnValue({ values: valuesMock });
  return { valuesMock, onConflictDoUpdateMock };
}
```

- [ ] **Step 2: Update billing.server.test.ts to use shared helper**

In `src/billing/billing.server.test.ts`, replace the local `mockDbChain` function with an import from the shared module:

Replace the local `function mockDbChain(result: ...)` definition with:

```ts
import { mockDbChain } from '@/test/mocks/db';
```

Then update all calls from `mockDbChain(result)` to `mockDbChain(dbSelectMock, result)` (passing the mock as the first argument).

- [ ] **Step 3: Run tests to verify no regressions**

Run: `pnpm test src/billing/billing.server.test.ts`
Expected: All billing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/test/mocks/db.ts src/billing/billing.server.test.ts
git commit -m "test(infra): extract mockDbChain to shared test utility"
```

---

### Task 4: Create shared auth mock helpers

**Files:**

- Create: `src/test/mocks/auth.ts`

- [ ] **Step 1: Create reusable auth client mocks**

```ts
// src/test/mocks/auth.ts

/**
 * Creates hoisted auth mock functions for use with vi.mock('@/auth/auth-client').
 * Call this inside vi.hoisted() and use the returned mocks in vi.mock().
 *
 * Usage:
 *   const { authMocks } = vi.hoisted(() => ({
 *     authMocks: createAuthClientMocks(),
 *   }));
 *   vi.mock('@/auth/auth-client', () => ({
 *     authClient: authMocks.authClient,
 *   }));
 */
export function createAuthClientMocks() {
  const signInEmail = vi.fn();
  const signUpEmail = vi.fn();
  const getSession = vi.fn();
  const listAccounts = vi.fn();
  const listSessions = vi.fn();

  const authClient = {
    signIn: { email: signInEmail },
    signUp: { email: signUpEmail },
    getSession,
    listAccounts,
    listSessions,
    organization: {
      setActive: vi.fn(),
      list: vi.fn(),
    },
  };

  return {
    authClient,
    signInEmail,
    signUpEmail,
    getSession,
    listAccounts,
    listSessions,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/test/mocks/auth.ts
git commit -m "test(infra): add shared auth client mock helpers"
```

---

### Task 5: Create shared router mock helpers

**Files:**

- Create: `src/test/mocks/router.ts`

- [ ] **Step 1: Create router mock helpers**

```ts
// src/test/mocks/router.ts

/**
 * Creates hoisted router mock functions.
 * Usage:
 *   const { routerMocks } = vi.hoisted(() => ({
 *     routerMocks: createRouterMocks(),
 *   }));
 *   vi.mock('@tanstack/react-router', async (importOriginal) => ({
 *     ...(await importOriginal<typeof import('@tanstack/react-router')>()),
 *     useNavigate: () => navigate,
 *     redirect: routerMocks.redirect,
 *   }));
 */
export function createRouterMocks() {
  return {
    navigate: vi.fn(),
    redirect: vi.fn((opts: unknown) => {
      throw opts;
    }),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/test/mocks/router.ts
git commit -m "test(infra): add shared router mock helpers"
```

---

### Task 6: Create renderWithProviders wrapper

**Files:**

- Create: `src/test/render.tsx`

- [ ] **Step 1: Create render wrapper with providers**

```tsx
// src/test/render.tsx
import { type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface ProvidersProps {
  children: ReactNode;
}

function TestProviders({ children }: ProvidersProps) {
  const queryClient = createTestQueryClient();
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

/**
 * Renders a component wrapped in all required providers (QueryClient, etc.).
 * Creates a fresh QueryClient per render to prevent cache leakage between tests.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: TestProviders, ...options });
}

/**
 * Creates a wrapper for use with renderHook from @testing-library/react.
 */
export function createHookWrapper() {
  const queryClient = createTestQueryClient();
  return function HookWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/test/render.tsx
git commit -m "test(infra): add renderWithProviders and createHookWrapper utilities"
```

---

### Task 7: Run full test suite to verify infrastructure

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All existing tests pass. No regressions from infrastructure changes.

---

## Chunk 2: Middleware Tests (Phase 1.2)

### Task 8: Refactor auth middleware to extract testable functions

**Files:**

- Modify: `src/middleware/auth.ts`

- [ ] **Step 1: Extract `validateAuthSession` and `validateGuestSession` functions**

Refactor `src/middleware/auth.ts` to:

```ts
import { redirect } from '@tanstack/react-router';
import { createMiddleware } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { auth } from '@/auth/auth.server';
import { ensureActiveWorkspaceForSession } from '@/workspace/workspace.server';

/** Validates that the request has an authenticated, email-verified session and an active workspace. */
export async function validateAuthSession(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }
  await ensureActiveWorkspaceForSession(headers, {
    user: { id: session.user.id },
    session: session.session,
  });
  return session;
}

/** Validates that the request is from a guest (no verified session). Redirects authenticated users. */
export async function validateGuestSession(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (session?.user.emailVerified) {
    throw redirect({ to: '/ws' });
  }
}

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  await validateAuthSession(headers);
  return await next();
});

export const guestMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  await validateGuestSession(headers);
  return await next();
});
```

- [ ] **Step 2: Run existing tests to verify no regressions**

Run: `pnpm test`
Expected: All tests pass. The refactor preserves behavior.

- [ ] **Step 3: Commit**

```bash
git add src/middleware/auth.ts
git commit -m "refactor(middleware): extract validateAuthSession and validateGuestSession for testability"
```

---

### Task 9: Write auth middleware tests

**Files:**

- Create: `src/middleware/auth.test.ts`

- [ ] **Step 1: Write the test file**

```ts
// src/middleware/auth.test.ts
import { createMockSessionResponse } from '@/test/factories';

const { mockGetSession, mockEnsureActiveWorkspace } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockEnsureActiveWorkspace: vi.fn(),
}));

vi.mock('@/auth/auth.server', () => ({
  auth: { api: { getSession: mockGetSession } },
}));

vi.mock('@/workspace/workspace.server', () => ({
  ensureActiveWorkspaceForSession: mockEnsureActiveWorkspace,
}));

import { validateAuthSession, validateGuestSession } from '@/middleware/auth';

describe('validateAuthSession', () => {
  const headers = new Headers({ cookie: 'test' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws redirect to /signin when no session exists', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(validateAuthSession(headers)).rejects.toEqual(
      expect.objectContaining({ to: '/signin' }),
    );
  });

  it('throws redirect to /signin when emailVerified is false', async () => {
    mockGetSession.mockResolvedValue(
      createMockSessionResponse({ emailVerified: false }),
    );
    await expect(validateAuthSession(headers)).rejects.toEqual(
      expect.objectContaining({ to: '/signin' }),
    );
  });

  it('calls ensureActiveWorkspaceForSession for verified sessions', async () => {
    const session = createMockSessionResponse();
    mockGetSession.mockResolvedValue(session);
    mockEnsureActiveWorkspace.mockResolvedValue(undefined);

    await validateAuthSession(headers);

    expect(mockEnsureActiveWorkspace).toHaveBeenCalledWith(headers, {
      user: { id: session.user.id },
      session: session.session,
    });
  });

  it('propagates errors from ensureActiveWorkspaceForSession', async () => {
    const session = createMockSessionResponse();
    mockGetSession.mockResolvedValue(session);
    mockEnsureActiveWorkspace.mockRejectedValue(new Error('workspace error'));

    await expect(validateAuthSession(headers)).rejects.toThrow(
      'workspace error',
    );
  });
});

describe('validateGuestSession', () => {
  const headers = new Headers({ cookie: 'test' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns without throwing when no session exists', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(validateGuestSession(headers)).resolves.toBeUndefined();
  });

  it('returns without throwing when emailVerified is false', async () => {
    mockGetSession.mockResolvedValue(
      createMockSessionResponse({ emailVerified: false }),
    );
    await expect(validateGuestSession(headers)).resolves.toBeUndefined();
  });

  it('throws redirect to /ws when session has emailVerified true', async () => {
    mockGetSession.mockResolvedValue(
      createMockSessionResponse({ emailVerified: true }),
    );
    await expect(validateGuestSession(headers)).rejects.toEqual(
      expect.objectContaining({ to: '/ws' }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm test src/middleware/auth.test.ts`
Expected: All 7 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/middleware/auth.test.ts
git commit -m "test(middleware): add tests for validateAuthSession and validateGuestSession"
```

---

### Task 10: Refactor admin middleware and write tests

**Files:**

- Modify: `src/middleware/admin.ts`
- Create: `src/middleware/admin.test.ts`

- [ ] **Step 1: Refactor admin middleware to extract validateAdminSession**

```ts
// src/middleware/admin.ts
import { redirect } from '@tanstack/react-router';
import { createMiddleware } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { auth } from '@/auth/auth.server';

/** Validates that the request has an admin session with verified email. */
export async function validateAdminSession(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }
  if (session.user.role !== 'admin') {
    throw redirect({ to: '/signin' });
  }
  return session;
}

export const adminMiddleware = createMiddleware().server(async ({ next }) => {
  const headers = getRequestHeaders();
  await validateAdminSession(headers);
  return await next();
});
```

- [ ] **Step 2: Write admin middleware tests**

```ts
// src/middleware/admin.test.ts
import { createMockSessionResponse } from '@/test/factories';

const { mockGetSession } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
}));

vi.mock('@/auth/auth.server', () => ({
  auth: { api: { getSession: mockGetSession } },
}));

import { validateAdminSession } from '@/middleware/admin';

describe('validateAdminSession', () => {
  const headers = new Headers({ cookie: 'test' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws redirect to /signin when no session exists', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(validateAdminSession(headers)).rejects.toEqual(
      expect.objectContaining({ to: '/signin' }),
    );
  });

  it('throws redirect to /signin when emailVerified is false', async () => {
    mockGetSession.mockResolvedValue(
      createMockSessionResponse({ emailVerified: false }),
    );
    await expect(validateAdminSession(headers)).rejects.toEqual(
      expect.objectContaining({ to: '/signin' }),
    );
  });

  it('throws redirect to /signin for non-admin role', async () => {
    mockGetSession.mockResolvedValue(
      createMockSessionResponse({ role: 'user' }),
    );
    await expect(validateAdminSession(headers)).rejects.toEqual(
      expect.objectContaining({ to: '/signin' }),
    );
  });

  it('returns session for admin with verified email', async () => {
    const session = createMockSessionResponse({ role: 'admin' });
    mockGetSession.mockResolvedValue(session);

    const result = await validateAdminSession(headers);
    expect(result).toEqual(session);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm test src/middleware/admin.test.ts`
Expected: All 4 tests pass.

- [ ] **Step 4: Run full test suite**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/middleware/admin.ts src/middleware/admin.test.ts
git commit -m "test(middleware): add tests for validateAdminSession with extracted function"
```

---

## Chunk 3: Auth Form Component Tests (Phase 1.3)

### Task 11: Write SigninForm unit tests

**Files:**

- Create: `src/components/auth/signin-form.test.tsx`

- [ ] **Step 1: Write the test file**

```tsx
// src/components/auth/signin-form.test.tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';

const { signInEmail, signUpEmail, navigate } = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@/auth/auth-client', () => ({
  authClient: {
    signIn: { email: signInEmail },
    signUp: { email: signUpEmail },
  },
}));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock Google sign-in button to avoid OAuth setup.
vi.mock('@/components/auth/google-sign-in-button', () => ({
  GoogleSignInButton: () => <button>Sign in with Google</button>,
}));

import { SigninForm } from '@/components/auth/signin-form';

describe('SigninForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email and password fields', () => {
    renderWithProviders(<SigninForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('shows validation errors on empty submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SigninForm />);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/please enter a valid email/i),
      ).toBeInTheDocument();
    });
  });

  it('calls authClient.signIn.email with correct params on submit', async () => {
    const user = userEvent.setup();
    signInEmail.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<SigninForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          password: 'password123',
          callbackURL: '/ws',
        }),
      );
    });
  });

  it('shows error message on 401 response', async () => {
    const user = userEvent.setup();
    signInEmail.mockResolvedValue({
      data: null,
      error: { status: 401, message: 'Invalid credentials' },
    });
    renderWithProviders(<SigninForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid/i)).toBeInTheDocument();
    });
  });

  it('navigates to /verify on 403 (unverified email)', async () => {
    const user = userEvent.setup();
    signInEmail.mockResolvedValue({
      data: null,
      error: { status: 403, message: 'Email not verified' },
    });
    renderWithProviders(<SigninForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '/verify',
          search: { email: 'test@example.com' },
        }),
      );
    });
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm test src/components/auth/signin-form.test.tsx`
Expected: All 5 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/signin-form.test.tsx
git commit -m "test(auth): add unit tests for SigninForm component"
```

---

### Task 12: Write SignupForm unit tests

**Files:**

- Create: `src/components/auth/signup-form.test.tsx`

- [ ] **Step 1: Write the test file**

```tsx
// src/components/auth/signup-form.test.tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';

const { signInEmail, signUpEmail, navigate } = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@/auth/auth-client', () => ({
  authClient: {
    signIn: { email: signInEmail },
    signUp: { email: signUpEmail },
  },
}));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('@/components/auth/google-sign-in-button', () => ({
  GoogleSignInButton: () => <button>Sign in with Google</button>,
}));

import { SignupForm } from '@/components/auth/signup-form';

describe('SignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email, password, and confirm password fields', () => {
    renderWithProviders(<SignupForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('shows validation error for short password', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupForm />);

    await user.type(screen.getByLabelText(/^password$/i), 'short');
    await user.tab(); // Trigger onBlur validation.

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('shows validation error for mismatched passwords', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupForm />);

    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'different');
    await user.click(screen.getByRole('button', { name: /sign up|create/i }));

    await waitFor(() => {
      expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    });
  });

  it('calls authClient.signUp.email with correct params on valid submit', async () => {
    const user = userEvent.setup();
    signUpEmail.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<SignupForm />);

    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign up|create/i }));

    await waitFor(() => {
      expect(signUpEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          password: 'password123',
        }),
      );
    });
  });

  it('navigates to /verify on successful signup', async () => {
    const user = userEvent.setup();
    signUpEmail.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<SignupForm />);

    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign up|create/i }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '/verify',
          search: { email: 'new@example.com' },
        }),
      );
    });
  });

  it('shows error message on 422 (email exists)', async () => {
    const user = userEvent.setup();
    signUpEmail.mockResolvedValue({
      data: null,
      error: { status: 422, message: 'User already exists' },
    });
    renderWithProviders(<SignupForm />);

    await user.type(screen.getByLabelText(/email/i), 'existing@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign up|create/i }));

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm test src/components/auth/signup-form.test.tsx`
Expected: All 6 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/signup-form.test.tsx
git commit -m "test(auth): add unit tests for SignupForm component"
```

---

### Task 13: Write auth form integration tests

**Files:**

- Create: `src/components/auth/signin-form.integration.test.tsx`
- Create: `src/components/auth/signup-form.integration.test.tsx`

- [ ] **Step 1: Write sign-in integration test**

```tsx
// src/components/auth/signin-form.integration.test.tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';

const { signInEmail, signUpEmail, navigate } = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@/auth/auth-client', () => ({
  authClient: {
    signIn: { email: signInEmail },
    signUp: { email: signUpEmail },
  },
}));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('@/components/auth/google-sign-in-button', () => ({
  GoogleSignInButton: () => <button>Sign in with Google</button>,
}));

import { SigninForm } from '@/components/auth/signin-form';

describe('SigninForm integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes full sign-in flow: fill → submit → navigate', async () => {
    const user = userEvent.setup();
    signInEmail.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<SigninForm />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledTimes(1);
    });
  });

  it('recovers from error: bad credentials → fix → retry succeeds', async () => {
    const user = userEvent.setup();
    signInEmail
      .mockResolvedValueOnce({
        data: null,
        error: { status: 401, message: 'Invalid credentials' },
      })
      .mockResolvedValueOnce({ data: {}, error: null });

    renderWithProviders(<SigninForm />);

    // First attempt: wrong password.
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid/i)).toBeInTheDocument();
    });

    // Second attempt: correct password.
    await user.clear(screen.getByLabelText(/password/i));
    await user.type(screen.getByLabelText(/password/i), 'correct123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(signInEmail).toHaveBeenCalledTimes(2);
    });
  });
});
```

- [ ] **Step 2: Write sign-up integration test**

```tsx
// src/components/auth/signup-form.integration.test.tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';

const { signInEmail, signUpEmail, navigate } = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@/auth/auth-client', () => ({
  authClient: {
    signIn: { email: signInEmail },
    signUp: { email: signUpEmail },
  },
}));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => navigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

vi.mock('@/components/auth/google-sign-in-button', () => ({
  GoogleSignInButton: () => <button>Sign in with Google</button>,
}));

import { SignupForm } from '@/components/auth/signup-form';

describe('SignupForm integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes full sign-up flow: fill → submit → navigate to /verify', async () => {
    const user = userEvent.setup();
    signUpEmail.mockResolvedValue({ data: {}, error: null });
    renderWithProviders(<SignupForm />);

    await user.type(screen.getByLabelText(/email/i), 'new@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'password123');
    await user.type(screen.getByLabelText(/confirm password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign up|create/i }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '/verify',
          search: { email: 'new@example.com' },
        }),
      );
    });
  });
});
```

- [ ] **Step 3: Run all auth tests**

Run: `pnpm test src/components/auth/`
Expected: All auth component tests pass.

- [ ] **Step 4: Run full test suite**

Run: `pnpm test`
Expected: All tests pass. Phase 1 is complete.

- [ ] **Step 5: Commit**

```bash
git add src/components/auth/signin-form.integration.test.tsx src/components/auth/signup-form.integration.test.tsx
git commit -m "test(auth): add integration tests for sign-in and sign-up flows"
```

---

## Chunk 4: Server Logic Tests (Phase 2.4)

### Task 14: Write notification preferences schema tests

**Files:**

- Create: `src/account/notification-preferences.schemas.test.ts`

- [ ] **Step 1: Write schema tests**

```ts
// src/account/notification-preferences.schemas.test.ts
import {
  updateNotificationPreferencesInput,
  notificationPreferencesSchema,
} from '@/account/notification-preferences.schemas';

describe('updateNotificationPreferencesInput', () => {
  it('accepts valid input with marketingEmails boolean', () => {
    const result = updateNotificationPreferencesInput.safeParse({
      marketingEmails: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (all fields optional)', () => {
    const result = updateNotificationPreferencesInput.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects unknown fields (strict mode)', () => {
    const result = updateNotificationPreferencesInput.safeParse({
      marketingEmails: true,
      unknownField: 'value',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-boolean marketingEmails', () => {
    const result = updateNotificationPreferencesInput.safeParse({
      marketingEmails: 'yes',
    });
    expect(result.success).toBe(false);
  });
});

describe('notificationPreferencesSchema', () => {
  it('accepts valid preferences', () => {
    const result = notificationPreferencesSchema.safeParse({
      emailUpdates: true,
      marketingEmails: false,
    });
    expect(result.success).toBe(true);
  });

  it('rejects emailUpdates as false (must be literal true)', () => {
    const result = notificationPreferencesSchema.safeParse({
      emailUpdates: false,
      marketingEmails: false,
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm test src/account/notification-preferences.schemas.test.ts`
Expected: All 6 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/account/notification-preferences.schemas.test.ts
git commit -m "test(account): add notification preferences schema tests"
```

---

### Task 15: Write notification preferences server tests

**Files:**

- Create: `src/account/notification-preferences.server.test.ts`

- [ ] **Step 1: Write server logic tests**

```ts
// src/account/notification-preferences.server.test.ts
import { mockDbChain, mockDbInsertChain } from '@/test/mocks/db';

const { dbSelectMock, dbInsertMock } = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  dbInsertMock: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: { select: dbSelectMock, insert: dbInsertMock },
}));

vi.mock('@/db/schema', () => ({
  notificationPreferences: {
    userId: 'userId',
    marketingEmails: 'marketingEmails',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
}));

import {
  getNotificationPreferencesForUser,
  upsertNotificationPreferencesForUser,
} from '@/account/notification-preferences.server';

describe('getNotificationPreferencesForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns defaults when no row exists', async () => {
    mockDbChain(dbSelectMock, []);

    const result = await getNotificationPreferencesForUser('user-1');
    expect(result).toEqual({
      emailUpdates: true,
      marketingEmails: false,
    });
  });

  it('returns stored preferences when row exists', async () => {
    mockDbChain(dbSelectMock, [{ marketingEmails: true }]);

    const result = await getNotificationPreferencesForUser('user-1');
    expect(result).toEqual({
      emailUpdates: true,
      marketingEmails: true,
    });
  });
});

describe('upsertNotificationPreferencesForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns current preferences when patch has no boolean marketingEmails', async () => {
    mockDbChain(dbSelectMock, [{ marketingEmails: false }]);

    const result = await upsertNotificationPreferencesForUser('user-1', {});
    expect(result).toEqual({
      emailUpdates: true,
      marketingEmails: false,
    });
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('upserts when marketingEmails is a boolean', async () => {
    mockDbInsertChain(dbInsertMock);
    // After upsert, it re-fetches.
    mockDbChain(dbSelectMock, [{ marketingEmails: true }]);

    const result = await upsertNotificationPreferencesForUser('user-1', {
      marketingEmails: true,
    });
    expect(dbInsertMock).toHaveBeenCalled();
    expect(result.marketingEmails).toBe(true);
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm test src/account/notification-preferences.server.test.ts`
Expected: All 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/account/notification-preferences.server.test.ts
git commit -m "test(account): add notification preferences server logic tests"
```

---

### Task 16: Write email sending tests

**Files:**

- Create: `src/email/resend.server.test.ts`

- [ ] **Step 1: Write email sending tests**

Note: This module reads env vars at module load time into constants and uses a singleton client. Each test uses `vi.resetModules()` + `vi.doMock('resend')` + dynamic import to ensure both the mock and env vars are fresh.

```ts
// src/email/resend.server.test.ts
import { createElement } from 'react';

const mockSend = vi.fn();

/** Helper: reset modules, re-register resend mock, dynamically import sendEmail. */
async function importSendEmail() {
  vi.resetModules();
  vi.doMock('resend', () => ({
    Resend: vi.fn().mockImplementation(() => ({
      emails: { send: mockSend },
    })),
  }));
  const mod = await import('@/email/resend.server');
  return mod;
}

describe('sendEmail', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockSend.mockReset();
    process.env.RESEND_API_KEY = 'test-api-key';
    process.env.RESEND_FROM_EMAIL = 'noreply@test.com';
    process.env.RESEND_REPLY_TO_EMAIL = '';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('sends email with correct params and [DEV] prefix in non-production', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });
    const { sendEmail } = await importSendEmail();

    const mockReact = createElement('div', null, 'Hello');
    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Welcome',
      react: mockReact,
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'noreply@test.com',
        to: 'user@example.com',
        subject: '[DEV] Welcome',
        react: mockReact,
      }),
    );
    expect(result).toEqual({ id: 'email-1' });
  });

  it('does not prefix subject in production', async () => {
    process.env.NODE_ENV = 'production';
    mockSend.mockResolvedValue({ data: { id: 'email-2' }, error: null });
    const { sendEmail } = await importSendEmail();

    await sendEmail({
      to: 'user@example.com',
      subject: 'Welcome',
      react: createElement('div'),
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Welcome' }),
    );
  });

  it('throws when Resend API returns an error', async () => {
    mockSend.mockResolvedValue({
      data: null,
      error: { message: 'Rate limit exceeded' },
    });
    const { sendEmail } = await importSendEmail();

    await expect(
      sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        react: createElement('div'),
      }),
    ).rejects.toThrow('Failed to send email: Rate limit exceeded');
  });

  it('throws when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await importSendEmail();

    await expect(
      sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        react: createElement('div'),
      }),
    ).rejects.toThrow('RESEND_API_KEY is required');
  });

  it('throws when RESEND_FROM_EMAIL is missing', async () => {
    delete process.env.RESEND_FROM_EMAIL;
    const { sendEmail } = await importSendEmail();

    await expect(
      sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        react: createElement('div'),
      }),
    ).rejects.toThrow('RESEND_FROM_EMAIL is required');
  });

  it('includes replyTo when RESEND_REPLY_TO_EMAIL is set', async () => {
    process.env.RESEND_REPLY_TO_EMAIL = 'reply@test.com';
    mockSend.mockResolvedValue({ data: { id: 'email-3' }, error: null });
    const { sendEmail } = await importSendEmail();

    await sendEmail({
      to: 'user@example.com',
      subject: 'Test',
      react: createElement('div'),
    });

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: 'reply@test.com' }),
    );
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm test src/email/resend.server.test.ts`
Expected: All 6 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/email/resend.server.test.ts
git commit -m "test(email): add sendEmail tests with env var isolation via dynamic imports"
```

---

### Task 17: Extend admin server tests for query functions

**Files:**

- Modify: `src/admin/admin.server.test.ts`

- [ ] **Step 1: Add tests for queryDashboardMetrics, querySignupChartData, queryMauChartData**

Append to existing `src/admin/admin.server.test.ts`. These query functions use `db.select().from()` with SQL aggregates. Mock the DB to return shaped data, then verify the functions process it correctly.

Read the existing test file first. It already has a `vi.hoisted()` block and `vi.mock()` calls. You need to:

1. **Add to the existing `vi.hoisted()` block:** Add `dbSelectMock: vi.fn()` alongside the existing mocks.
2. **Add a new `vi.mock('@/db', ...)` call** (the existing file does not mock `@/db` — add it after the other `vi.mock()` calls):
   ```ts
   vi.mock('@/db', () => ({ db: { select: dbSelectMock } }));
   ```
3. **Add a new `vi.mock('drizzle-orm', ...)` call:**
   ```ts
   vi.mock('drizzle-orm', () => ({
     and: vi.fn((...args: unknown[]) => args),
     gte: vi.fn((a: unknown, b: unknown) => ({
       op: 'gte',
       field: a,
       value: b,
     })),
     lt: vi.fn((a: unknown, b: unknown) => ({ op: 'lt', field: a, value: b })),
     isNotNull: vi.fn((a: unknown) => ({ op: 'isNotNull', field: a })),
     sql: vi.fn(),
   }));
   ```
4. **Add a new `vi.mock('@/db/schema', ...)` call:**
   ```ts
   vi.mock('@/db/schema', () => ({ user: 'user' }));
   ```
5. **Add the new `import` for the query functions** alongside the existing imports:
   ```ts
   import {
     queryDashboardMetrics,
     querySignupChartData,
     queryMauChartData,
   } from '@/admin/admin.server';
   ```

Then append these `describe` blocks at the end of the file:

Note: The query functions call `getLocalDayStartUtc` and `getDayBuckets` internally (already tested). Focus tests on: correct DB query execution, correct data transformation, and empty result handling.

```ts
describe('queryDashboardMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns metrics from DB query result', async () => {
    const mockRow = {
      totalUsers: 100,
      verifiedUsers: 80,
      unverifiedUsers: 20,
      signupsToday: 5,
      verifiedToday: 3,
      unverifiedToday: 2,
    };
    // Mock db.select().from() chain to resolve to [mockRow].
    const fromMock = vi.fn().mockResolvedValue([mockRow]);
    dbSelectMock.mockReturnValue({ from: fromMock });

    const result = await queryDashboardMetrics(0);
    expect(result).toEqual(mockRow);
  });
});

describe('querySignupChartData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns chart data with verified/unverified counts per day', async () => {
    // Mock: two users signed up on the same day.
    const today = new Date('2026-03-13T10:00:00Z');
    const mockRows = [
      { createdAt: today, emailVerified: true },
      { createdAt: today, emailVerified: false },
    ];
    const whereMock = vi.fn().mockResolvedValue(mockRows);
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    dbSelectMock.mockReturnValue({ from: fromMock });

    const result = await querySignupChartData(7, 0);
    expect(result).toHaveLength(7);
    // The last bucket (today) should have 1 verified, 1 unverified.
    const todayBucket = result[result.length - 1];
    expect(todayBucket.verified).toBe(1);
    expect(todayBucket.unverified).toBe(1);
  });

  it('returns empty counts for days with no signups', async () => {
    const whereMock = vi.fn().mockResolvedValue([]);
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    dbSelectMock.mockReturnValue({ from: fromMock });

    const result = await querySignupChartData(7, 0);
    expect(result).toHaveLength(7);
    result.forEach((bucket) => {
      expect(bucket.verified).toBe(0);
      expect(bucket.unverified).toBe(0);
    });
  });
});

describe('queryMauChartData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts MAU using 30-day sliding window', async () => {
    const recentSignIn = new Date('2026-03-12T10:00:00Z');
    const mockRows = [{ lastSignInAt: recentSignIn }];
    const whereMock = vi.fn().mockResolvedValue(mockRows);
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    dbSelectMock.mockReturnValue({ from: fromMock });

    const result = await queryMauChartData(7, 0);
    expect(result).toHaveLength(7);
    // The last bucket should include the recent sign-in.
    const todayBucket = result[result.length - 1];
    expect(todayBucket.mau).toBeGreaterThanOrEqual(1);
  });

  it('returns zero MAU for days with no activity', async () => {
    const whereMock = vi.fn().mockResolvedValue([]);
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    dbSelectMock.mockReturnValue({ from: fromMock });

    const result = await queryMauChartData(7, 0);
    result.forEach((bucket) => {
      expect(bucket.mau).toBe(0);
    });
  });
});
```

Note: The exact integration with the existing test file's mock setup will require reading the current mock structure and extending it. The implementor should read `src/admin/admin.server.test.ts` first, then add the DB mock (`dbSelectMock`) to the existing `vi.hoisted()` block and add the `vi.mock('@/db', ...)` call alongside the existing mocks.

- [ ] **Step 2: Run admin tests**

Run: `pnpm test src/admin/admin.server.test.ts`
Expected: All tests pass (existing + new).

- [ ] **Step 3: Commit**

```bash
git add src/admin/admin.server.test.ts
git commit -m "test(admin): add tests for dashboard metrics and chart query functions"
```

---

## Chunk 5: Hook Tests (Phase 3.1)

### Task 18: Write useSessionQuery tests

**Files:**

- Create: `src/hooks/use-session-query.test.ts`

- [ ] **Step 1: Write hook tests**

```ts
// src/hooks/use-session-query.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@/test/render';

const { getSession, listAccounts, listSessions } = vi.hoisted(() => ({
  getSession: vi.fn(),
  listAccounts: vi.fn(),
  listSessions: vi.fn(),
}));

vi.mock('@/auth/auth-client', () => ({
  authClient: {
    getSession,
    listAccounts,
    listSessions,
  },
}));

import { useSessionQuery, SESSION_QUERY_KEY } from '@/hooks/use-session-query';

describe('useSessionQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns session data on success', async () => {
    const mockSession = { user: { id: 'user-1' }, session: { id: 'sess-1' } };
    getSession.mockResolvedValue({
      data: mockSession,
      error: null,
    });

    const { result } = renderHook(() => useSessionQuery(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(mockSession);
  });

  it('returns null when no session exists', async () => {
    getSession.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useSessionQuery(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
  });

  it('throws error when auth returns an error', async () => {
    getSession.mockResolvedValue({
      data: null,
      error: { message: 'Unauthorized' },
    });

    const { result } = renderHook(() => useSessionQuery(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe('Unauthorized');
  });

  it('uses correct query key', () => {
    expect(SESSION_QUERY_KEY).toEqual(['current_session']);
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm test src/hooks/use-session-query.test.ts`
Expected: All 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-session-query.test.ts
git commit -m "test(hooks): add useSessionQuery tests"
```

---

### Task 19: Write useUpgradePrompt tests

**Files:**

- Create: `src/hooks/use-upgrade-prompt.test.ts`

- [ ] **Step 1: Write hook tests**

```ts
// src/hooks/use-upgrade-prompt.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@/test/render';

const { mockCreateCheckoutSession, mockToastError } = vi.hoisted(() => ({
  mockCreateCheckoutSession: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('@/billing/billing.functions', () => ({
  createCheckoutSession: mockCreateCheckoutSession,
}));

vi.mock('sonner', () => ({
  toast: { error: mockToastError },
}));

import { useUpgradePrompt } from '@/hooks/use-upgrade-prompt';

const mockPlan = {
  id: 'pro' as const,
  name: 'Pro',
  description: 'Pro plan',
  monthlyPricing: { amount: 10 },
  annualPricing: { amount: 100 },
  limits: { maxWorkspaces: 10, maxMembersPerWorkspace: 50 },
};

describe('useUpgradePrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with dialog closed', () => {
    const { result } = renderHook(() => useUpgradePrompt(), {
      wrapper: createHookWrapper(),
    });
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('show() populates dialog props', () => {
    const { result } = renderHook(() => useUpgradePrompt(), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Upgrade', 'You need more', mockPlan);
    });

    expect(result.current.dialogProps.open).toBe(true);
    expect(result.current.dialogProps.title).toBe('Upgrade');
    expect(result.current.dialogProps.description).toBe('You need more');
    expect(result.current.dialogProps.upgradePlan).toBe(mockPlan);
  });

  it('onOpenChange(false) closes dialog', () => {
    const { result } = renderHook(() => useUpgradePrompt(), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Upgrade', 'Description', mockPlan);
    });
    expect(result.current.dialogProps.open).toBe(true);

    act(() => {
      result.current.dialogProps.onOpenChange(false);
    });
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('onUpgrade() fires mutation with correct planId and annual', async () => {
    mockCreateCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/test',
    });

    const { result } = renderHook(() => useUpgradePrompt(), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Upgrade', 'Description', mockPlan);
    });

    act(() => {
      result.current.dialogProps.onUpgrade();
    });

    await waitFor(() => {
      expect(mockCreateCheckoutSession).toHaveBeenCalledWith({
        data: { planId: 'pro', annual: false },
      });
    });
  });

  it('onUpgrade() is no-op when upgradePlan is null', () => {
    const { result } = renderHook(() => useUpgradePrompt(), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Limit Reached', 'Max tier', null);
    });

    act(() => {
      result.current.dialogProps.onUpgrade();
    });

    expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
  });

  it('shows toast on checkout error', async () => {
    mockCreateCheckoutSession.mockRejectedValue(new Error('Checkout failed'));

    const { result } = renderHook(() => useUpgradePrompt(), {
      wrapper: createHookWrapper(),
    });

    act(() => {
      result.current.show('Upgrade', 'Description', mockPlan);
    });

    act(() => {
      result.current.dialogProps.onUpgrade();
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Checkout failed');
    });
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm test src/hooks/use-upgrade-prompt.test.ts`
Expected: All 6 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-upgrade-prompt.test.ts
git commit -m "test(hooks): add useUpgradePrompt tests"
```

---

### Task 20: Write useLinkedAccountsQuery and useSessionsQuery tests

**Files:**

- Create: `src/hooks/use-linked-accounts-query.test.ts`
- Create: `src/hooks/use-sessions-query.test.ts`

- [ ] **Step 1: Write useLinkedAccountsQuery tests**

```ts
// src/hooks/use-linked-accounts-query.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@/test/render';

const { getSession, listAccounts, listSessions } = vi.hoisted(() => ({
  getSession: vi.fn(),
  listAccounts: vi.fn(),
  listSessions: vi.fn(),
}));

vi.mock('@/auth/auth-client', () => ({
  authClient: {
    getSession,
    listAccounts,
    listSessions,
  },
}));

import {
  useLinkedAccountsQuery,
  LINKED_ACCOUNTS_QUERY_KEY,
} from '@/hooks/use-linked-accounts-query';

describe('useLinkedAccountsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns linked accounts on success', async () => {
    const mockAccounts = [{ provider: 'google', accountId: 'g-1' }];
    listAccounts.mockResolvedValue({
      data: mockAccounts,
      error: null,
    });

    const { result } = renderHook(() => useLinkedAccountsQuery(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(mockAccounts);
  });

  it('handles empty accounts list', async () => {
    listAccounts.mockResolvedValue({ data: [], error: null });

    const { result } = renderHook(() => useLinkedAccountsQuery(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual([]);
  });

  it('throws on error', async () => {
    listAccounts.mockResolvedValue({
      data: null,
      error: { message: 'Failed' },
    });

    const { result } = renderHook(() => useLinkedAccountsQuery(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('uses correct query key', () => {
    expect(LINKED_ACCOUNTS_QUERY_KEY).toEqual(['linked_accounts']);
  });
});
```

- [ ] **Step 2: Write useSessionsQuery tests**

```ts
// src/hooks/use-sessions-query.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@/test/render';

const { getSession, listAccounts, listSessions } = vi.hoisted(() => ({
  getSession: vi.fn(),
  listAccounts: vi.fn(),
  listSessions: vi.fn(),
}));

vi.mock('@/auth/auth-client', () => ({
  authClient: {
    getSession,
    listAccounts,
    listSessions,
  },
}));

import {
  useSessionsQuery,
  SESSIONS_QUERY_KEY,
} from '@/hooks/use-sessions-query';

describe('useSessionsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns active sessions on success', async () => {
    const mockSessions = [
      { id: 'sess-1', userAgent: 'Chrome' },
      { id: 'sess-2', userAgent: 'Firefox' },
    ];
    listSessions.mockResolvedValue({
      data: mockSessions,
      error: null,
    });

    const { result } = renderHook(() => useSessionsQuery(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(mockSessions);
  });

  it('handles error state', async () => {
    listSessions.mockResolvedValue({
      data: null,
      error: { message: 'Session error' },
    });

    const { result } = renderHook(() => useSessionsQuery(), {
      wrapper: createHookWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe('Session error');
  });

  it('uses correct query key', () => {
    expect(SESSIONS_QUERY_KEY).toEqual(['user_active_sessions']);
  });
});
```

- [ ] **Step 3: Run all hook tests**

Run: `pnpm test src/hooks/`
Expected: All hook tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/use-linked-accounts-query.test.ts src/hooks/use-sessions-query.test.ts
git commit -m "test(hooks): add useLinkedAccountsQuery and useSessionsQuery tests"
```

---

## Chunk 6: Final Verification

### Task 21: Run full test suite and verify

- [ ] **Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests pass — existing 15 + new ~20 test files.

- [ ] **Step 2: Run type check**

Run: `pnpm run typecheck`
Expected: No type errors.

- [ ] **Step 3: Run lint**

Run: `pnpm run lint`
Expected: No lint errors.

---

## Summary

| Chunk           | Tasks  | New files                           | Modified files                                   |
| --------------- | ------ | ----------------------------------- | ------------------------------------------------ |
| 1: Test infra   | 1–7    | 5 (`src/test/`)                     | 2 (`vitest.config.ts`, `billing.server.test.ts`) |
| 2: Middleware   | 8–10   | 2 (`auth.test.ts`, `admin.test.ts`) | 2 (`auth.ts`, `admin.ts`)                        |
| 3: Auth forms   | 11–13  | 4 (unit + integration tests)        | 0                                                |
| 4: Server logic | 14–17  | 3 (schemas, notif prefs, email)     | 1 (`admin.server.test.ts`)                       |
| 5: Hooks        | 18–20  | 4 (all hook tests)                  | 0                                                |
| 6: Verification | 21     | 0                                   | 0                                                |
| **Total**       | **21** | **18**                              | **5**                                            |

> **Note:** Phase 2 UI component tests (workspace, account, admin) are deferred to a follow-up plan. They require reading the actual component files to write accurate tests — each component has unique props, callbacks, and rendering patterns. This plan covers all Phase 1, Phase 2 server logic, and Phase 3 hooks/email.
