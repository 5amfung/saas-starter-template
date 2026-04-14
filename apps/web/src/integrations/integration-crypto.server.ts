import {
  decryptIntegrationSecret as decryptIntegrationSecretFromPackage,
  encryptIntegrationSecret as encryptIntegrationSecretFromPackage,
  maskIntegrationSecret,
  type EncryptedIntegrationSecret,
} from '@workspace/integrations';
import { getWorkspaceIntegrationEncryptionKey } from './integration-encryption-key.server';

export type { EncryptedIntegrationSecret };

export function encryptIntegrationSecret(
  value: string
): EncryptedIntegrationSecret {
  return encryptIntegrationSecretFromPackage(
    value,
    getWorkspaceIntegrationEncryptionKey()
  );
}

export function decryptIntegrationSecret(
  encrypted: EncryptedIntegrationSecret
): string {
  return decryptIntegrationSecretFromPackage(
    encrypted,
    getWorkspaceIntegrationEncryptionKey()
  );
}

export { maskIntegrationSecret };
