export const INTEGRATION_KEYS = ['slack'] as const;
export const INTEGRATION_FIELD_KEYS = ['clientId', 'clientSecret'] as const;

export type IntegrationKey = (typeof INTEGRATION_KEYS)[number];
export type IntegrationFieldKey = (typeof INTEGRATION_FIELD_KEYS)[number];

export const INTEGRATION_DEFINITIONS = {
  slack: {
    label: 'Slack',
    fields: [
      {
        key: 'clientId',
        label: 'Client ID',
        secret: true,
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        secret: true,
      },
    ],
  },
} as const satisfies Record<
  IntegrationKey,
  {
    label: string;
    fields: ReadonlyArray<{
      key: IntegrationFieldKey;
      label: string;
      secret: boolean;
    }>;
  }
>;

export function isIntegrationFieldKey(
  value: string
): value is IntegrationFieldKey {
  return INTEGRATION_FIELD_KEYS.includes(value as IntegrationFieldKey);
}

export function isIntegrationFieldKeyForIntegration(
  integration: IntegrationKey,
  value: string
): value is IntegrationFieldKey {
  return INTEGRATION_DEFINITIONS[integration].fields.some(
    (field) => field.key === value
  );
}
