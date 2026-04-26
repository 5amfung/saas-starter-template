import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import * as z from 'zod';
import {
  INTEGRATION_KEYS,
  isIntegrationFieldKeyForIntegration,
} from './integration-definitions';
import {
  getWorkspaceIntegrationsSummary,
  revealWorkspaceIntegrationSecretValue,
  updateWorkspaceIntegrationSecretValues,
} from './integration-secrets.server';
import type { IntegrationFieldKey } from './integration-definitions';
import { getAuth } from '@/init.server';

const workspaceIntegrationInput = z.object({
  workspaceId: z.string().min(1),
});

function refineIntegrationField(
  integration: string,
  key: string,
  ctx: z.RefinementCtx,
  path: Array<string | number>
) {
  if (
    INTEGRATION_KEYS.includes(
      integration as (typeof INTEGRATION_KEYS)[number]
    ) &&
    !isIntegrationFieldKeyForIntegration(
      integration as (typeof INTEGRATION_KEYS)[number],
      key
    )
  ) {
    ctx.addIssue({
      code: 'custom',
      message: `Unsupported field "${key}" for integration "${integration}".`,
      path,
    });
  }
}

const integrationFieldInput = workspaceIntegrationInput
  .extend({
    integration: z.enum(INTEGRATION_KEYS),
    key: z.string().min(1),
  })
  .superRefine((value, ctx) => {
    refineIntegrationField(value.integration, value.key, ctx, ['key']);
  });

const updateIntegrationValuesInput = workspaceIntegrationInput
  .extend({
    integration: z.enum(INTEGRATION_KEYS),
    values: z.array(
      z.object({
        key: z.string().min(1),
        value: z.string(),
      })
    ),
  })
  .superRefine((value, ctx) => {
    value.values.forEach((entry, index) => {
      refineIntegrationField(value.integration, entry.key, ctx, [
        'values',
        index,
        'key',
      ]);
    });
  });

async function requireVerifiedSession(headers: Headers) {
  const session = await getAuth().api.getSession({ headers });
  if (!session || !session.user.emailVerified) {
    throw redirect({ to: '/signin' });
  }

  return session;
}

export const getWorkspaceIntegrations = createServerFn()
  .inputValidator(workspaceIntegrationInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await requireVerifiedSession(headers);

    return getWorkspaceIntegrationsSummary(
      headers,
      data.workspaceId,
      session.user.id
    );
  });

export const revealWorkspaceIntegrationValue = createServerFn()
  .inputValidator(integrationFieldInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await requireVerifiedSession(headers);

    return revealWorkspaceIntegrationSecretValue(
      headers,
      data.workspaceId,
      session.user.id,
      data.integration,
      data.key as IntegrationFieldKey
    );
  });

export const updateWorkspaceIntegrationValues = createServerFn()
  .inputValidator(updateIntegrationValuesInput)
  .handler(async ({ data }) => {
    const headers = getRequestHeaders();
    const session = await requireVerifiedSession(headers);

    return updateWorkspaceIntegrationSecretValues(
      headers,
      data.workspaceId,
      session.user.id,
      data.integration,
      data.values as Array<{ key: IntegrationFieldKey; value: string }>
    );
  });
