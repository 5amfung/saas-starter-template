import { describe, expect, it } from 'vitest';
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  maskIntegrationSecret,
} from '@/integrations/core/crypto';

const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

describe('integration crypto', () => {
  it('round-trips plaintext through AES-256-GCM', () => {
    const encrypted = encryptIntegrationSecret(
      'xoxb-slack-secret',
      ENCRYPTION_KEY
    );

    expect(encrypted.encryptedValue).not.toBe('xoxb-slack-secret');
    expect(decryptIntegrationSecret(encrypted, ENCRYPTION_KEY)).toBe(
      'xoxb-slack-secret'
    );
  });

  it('masks all but the first six characters', () => {
    expect(maskIntegrationSecret('ro_ad8secret')).toBe('ro_ad8******');
  });
});
