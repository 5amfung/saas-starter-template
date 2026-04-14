export function getWorkspaceIntegrationEncryptionKey(): string {
  const dedicatedKey = process.env.WORKSPACE_SECRET_ENCRYPTION_KEY;
  if (dedicatedKey) {
    return dedicatedKey;
  }

  throw new Error('WORKSPACE_SECRET_ENCRYPTION_KEY is required.');
}
