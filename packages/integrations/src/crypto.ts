import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import type { EncryptedIntegrationSecret } from './types';

const ENCRYPTION_VERSION = 1;
const ALGORITHM = 'aes-256-gcm';

function parseEncryptionKey(encryptionKey: string) {
  const key = Buffer.from(encryptionKey, 'base64');
  if (key.length !== 32) {
    throw new Error('Integration encryption key must decode to 32 bytes.');
  }

  return key;
}

export function encryptIntegrationSecret(
  value: string,
  encryptionKey: string
): EncryptedIntegrationSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    ALGORITHM,
    parseEncryptionKey(encryptionKey),
    iv
  );
  const encryptedValue = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedValue: encryptedValue.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    encryptionVersion: ENCRYPTION_VERSION,
  };
}

export function decryptIntegrationSecret(
  encrypted: EncryptedIntegrationSecret,
  encryptionKey: string
): string {
  if (encrypted.encryptionVersion !== ENCRYPTION_VERSION) {
    throw new Error(
      `Unsupported integration secret encryption version: ${encrypted.encryptionVersion}`
    );
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    parseEncryptionKey(encryptionKey),
    Buffer.from(encrypted.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(encrypted.authTag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.encryptedValue, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function maskIntegrationSecret(value: string): string {
  const visiblePrefixLength = Math.min(6, Math.max(0, value.length - 1));
  const visiblePrefix = value.slice(0, visiblePrefixLength);
  const hiddenLength = Math.max(4, value.length - visiblePrefix.length);
  return `${visiblePrefix}${'*'.repeat(hiddenLength)}`;
}
