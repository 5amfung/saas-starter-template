import { describe, expect, it } from 'vitest';
import { parseWorkspaceBillingSnapshot } from '../../../src/contracts/snapshot';
import { buildWorkspaceBillingSnapshotFixture } from '../../fixtures/workspace-billing-snapshot.fixture';

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
