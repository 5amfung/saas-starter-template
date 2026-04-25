import { describe, expect, it } from 'vitest';
import { buildWorkspaceBillingSnapshotFixture } from '../fixtures/workspace-billing-snapshot.fixture';
import { parseWorkspaceBillingSnapshot } from '@/billing/core/contracts/snapshot';

describe('workspaceBillingSnapshot contract', () => {
  it('accepts a complete snapshot payload', () => {
    const payload = buildWorkspaceBillingSnapshotFixture();
    expect(parseWorkspaceBillingSnapshot(payload)).toEqual(payload);
  });

  it('rejects payloads missing currentEntitlements', () => {
    const payload = buildWorkspaceBillingSnapshotFixture();
    const invalidPayload = { ...payload };
    Reflect.deleteProperty(invalidPayload, 'currentEntitlements');

    expect(() => parseWorkspaceBillingSnapshot(invalidPayload)).toThrow();
  });
});
