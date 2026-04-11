import {
  decryptIntegrationSecret as decryptIntegrationSecretFromPackage,
  encryptIntegrationSecret as encryptIntegrationSecretFromPackage,
  maskIntegrationSecret,
  type EncryptedIntegrationSecret,
} from '@workspace/integrations';

function getIntegrationEncryptionKey() {
  const raw = process.env.WORKSPACE_SECRET_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('WORKSPACE_SECRET_ENCRYPTION_KEY is required.');
  }

  return raw;
}

export type { EncryptedIntegrationSecret };

export function encryptIntegrationSecret(
  value: string
): EncryptedIntegrationSecret {
  return encryptIntegrationSecretFromPackage(
    value,
    getIntegrationEncryptionKey()
  );
}

export function decryptIntegrationSecret(
  encrypted: EncryptedIntegrationSecret
): string {
  return decryptIntegrationSecretFromPackage(
    encrypted,
    getIntegrationEncryptionKey()
  );
}

export { maskIntegrationSecret };
