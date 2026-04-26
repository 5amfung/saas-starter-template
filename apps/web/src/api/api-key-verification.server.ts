import { getAuth } from '@/init.server';

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
      reason: 'missing-key';
    }
  | {
      ok: false;
      reason: 'invalid-key';
    }
  | {
      ok: false;
      reason: 'rate-limited';
      retryAfterSeconds: number | null;
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

type BetterAuthRateLimitError = {
  statusCode?: unknown;
  body?: {
    code?: unknown;
    details?: {
      tryAgainIn?: unknown;
    };
  };
};

function getRetryAfterSeconds(error: BetterAuthRateLimitError): number | null {
  const tryAgainIn = error.body?.details?.tryAgainIn;
  if (typeof tryAgainIn !== 'number' || !Number.isFinite(tryAgainIn)) {
    return null;
  }

  return Math.max(1, Math.ceil(tryAgainIn / 1000));
}

function isBetterAuthRateLimitError(
  error: unknown
): error is BetterAuthRateLimitError {
  if (!error || typeof error !== 'object') return false;

  const rateLimitError = error as BetterAuthRateLimitError;
  return (
    rateLimitError.statusCode === 429 ||
    rateLimitError.body?.code === 'RATE_LIMITED'
  );
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
      reason: 'missing-key',
    };
  }

  if (!workspaceId) {
    return {
      ok: false,
      reason: 'missing-workspace',
    };
  }

  let verification: VerifyApiKeyResult;
  try {
    verification = (await getAuth().api.verifyApiKey({
      body: {
        configId: SYSTEM_MANAGED_API_KEY_CONFIG_ID,
        key: apiKey,
      },
    })) as VerifyApiKeyResult;
  } catch (error) {
    if (isBetterAuthRateLimitError(error)) {
      return {
        ok: false,
        reason: 'rate-limited',
        retryAfterSeconds: getRetryAfterSeconds(error),
      };
    }

    throw error;
  }

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
