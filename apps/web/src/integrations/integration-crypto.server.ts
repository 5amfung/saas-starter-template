import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ENCRYPTION_VERSION = 1;
const ALGORITHM = 'aes-256-gcm';

interface EncryptedIntegrationSecret {
  encryptedValue: string;
  iv: string;
  authTag: string;
  encryptionVersion: number;
}

function getIntegrationEncryptionKey() {
  const raw = process.env.WORKSPACE_SECRET_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('WORKSPACE_SECRET_ENCRYPTION_KEY is required.');
  }

  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('WORKSPACE_SECRET_ENCRYPTION_KEY must decode to 32 bytes.');
  }

  return key;
}

export function encryptIntegrationSecret(
  value: string
): EncryptedIntegrationSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getIntegrationEncryptionKey(), iv);
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
  encrypted: EncryptedIntegrationSecret
): string {
  if (encrypted.encryptionVersion !== ENCRYPTION_VERSION) {
    throw new Error(
      `Unsupported integration secret encryption version: ${encrypted.encryptionVersion}`
    );
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getIntegrationEncryptionKey(),
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
