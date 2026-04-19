import { getAuth } from '@/init';

const SYSTEM_MANAGED_API_KEY_CONFIG_ID = 'system-managed';

type VerifyApiKeyResult = {
  valid: boolean;
  error: { code: string; message: string } | null;
  key: {
    id: string;
    referenceId: string;
  } | null;
};

export type WorkspaceApiKeyVerificationResult =
  | {
      ok: true;
      keyId: string;
      workspaceId: string;
    }
  | {
      ok: false;
      reason: 'invalid-key';
    }
  | {
      ok: false;
      reason: 'missing-workspace';
    }
  | {
      ok: false;
      reason: 'forbidden';
      keyId: string;
    };

function normalizeHeaderValue(value: string | null): string | null {
  if (value === null) return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function verifyWorkspaceApiKey(input: {
  apiKey: string | null;
  workspaceId: string | null;
}): Promise<WorkspaceApiKeyVerificationResult> {
  const apiKey = normalizeHeaderValue(input.apiKey);
  const workspaceId = normalizeHeaderValue(input.workspaceId);

  if (!apiKey) {
    return {
      ok: false,
      reason: 'invalid-key',
    };
  }

  if (!workspaceId) {
    return {
      ok: false,
      reason: 'missing-workspace',
    };
  }

  const verification = (await getAuth().api.verifyApiKey({
    body: {
      configId: SYSTEM_MANAGED_API_KEY_CONFIG_ID,
      key: apiKey,
    },
  })) as VerifyApiKeyResult;

  if (!verification.valid || !verification.key) {
    return {
      ok: false,
      reason: 'invalid-key',
    };
  }

  if (verification.key.referenceId !== workspaceId) {
    return {
      ok: false,
      reason: 'forbidden',
      keyId: verification.key.id,
    };
  }

  return {
    ok: true,
    keyId: verification.key.id,
    workspaceId,
  };
}
