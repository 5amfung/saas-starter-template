import { getWorkspaceIntegrationEncryptionKey } from './integration-encryption-key.server';
import type { EncryptedIntegrationSecret } from '@/integrations/core';
import {
  decryptIntegrationSecret as decryptIntegrationSecretFromPackage,
  encryptIntegrationSecret as encryptIntegrationSecretFromPackage,
  maskIntegrationSecret,
} from '@/integrations/core';

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
