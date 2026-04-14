import {
  decryptIntegrationSecret as decryptIntegrationSecretFromPackage,
  encryptIntegrationSecret as encryptIntegrationSecretFromPackage,
  maskIntegrationSecret,
} from '@workspace/integrations';
import { getWorkspaceIntegrationEncryptionKey } from './integration-encryption-key.server';
import type { EncryptedIntegrationSecret } from '@workspace/integrations';

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
