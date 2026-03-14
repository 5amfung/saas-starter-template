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
  const user = createMockUser(userOverrides);
  return {
    user,
    session: createMockSession({ userId: user.id, ...sessionOverrides }),
  };
}

interface MockMemberRow {
  id: string;
  userId: string;
  email: string;
  role: string;
}

export function createMockMemberRow(
  overrides: Partial<MockMemberRow> = {},
): MockMemberRow {
  return {
    id: 'member-1',
    userId: 'user-1',
    email: 'member@example.com',
    role: 'member',
    ...overrides,
  };
}

interface MockInvitationRow {
  id: string;
  email: string;
  role: string;
  invitedAt: string;
}

export function createMockInvitationRow(
  overrides: Partial<MockInvitationRow> = {},
): MockInvitationRow {
  return {
    id: 'invitation-1',
    email: 'invited@example.com',
    role: 'member',
    invitedAt: '2025-03-01T00:00:00.000Z',
    ...overrides,
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
