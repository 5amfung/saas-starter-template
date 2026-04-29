type SentryDsnConfig = {
  host: string;
  projectIds: Array<string>;
};

type BuildSentryEnvelopeUrlOptions = {
  configuredDsn: string;
  envelope: string;
};

type SentryEnvelopeHeader = {
  dsn?: unknown;
};

export function parseSentryDsn(dsn: string): SentryDsnConfig {
  const url = new URL(dsn);
  const projectId = url.pathname.replace(/^\/+|\/+$/g, '');

  if (!projectId) {
    throw new Error('Sentry DSN must include a project id');
  }

  return {
    host: url.hostname,
    projectIds: [projectId],
  };
}

function parseEnvelopeDsn(envelope: string): string {
  const [headerLine] = envelope.split('\n', 1);

  if (!headerLine) {
    throw new Error('Sentry envelope must include a header');
  }

  const header = JSON.parse(headerLine) as SentryEnvelopeHeader;

  if (typeof header.dsn !== 'string' || !header.dsn) {
    throw new Error('Sentry envelope must include a DSN');
  }

  return header.dsn;
}

export function buildSentryEnvelopeUrl({
  configuredDsn,
  envelope,
}: BuildSentryEnvelopeUrlOptions): string {
  const configured = parseSentryDsn(configuredDsn);
  const envelopeDsn = parseSentryDsn(parseEnvelopeDsn(envelope));
  const projectId = envelopeDsn.projectIds[0];

  if (envelopeDsn.host !== configured.host) {
    throw new Error(`Invalid Sentry hostname: ${envelopeDsn.host}`);
  }

  if (!projectId || !configured.projectIds.includes(projectId)) {
    throw new Error(`Invalid Sentry project id: ${projectId}`);
  }

  return `https://${configured.host}/api/${projectId}/envelope/`;
}
