type SentryDsnConfig = {
  host: string;
  origin: string;
  pathPrefix: string;
  projectIds: Array<string>;
};

type BuildSentryEnvelopeUrlOptions = {
  configuredDsn: string;
  envelopeHeader: string;
};

type SentryEnvelopeHeader = {
  dsn?: unknown;
};

export function parseSentryDsn(dsn: string): SentryDsnConfig {
  const url = new URL(dsn);
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const projectId = pathSegments.at(-1);

  if (!projectId) {
    throw new Error('Sentry DSN must include a project id');
  }

  const pathPrefix =
    pathSegments.length > 1 ? `/${pathSegments.slice(0, -1).join('/')}` : '';

  return {
    host: url.hostname,
    origin: url.origin,
    pathPrefix,
    projectIds: [projectId],
  };
}

export function getSentryEnvelopeHeader(envelopeBytes: ArrayBuffer): string {
  const bytes = new Uint8Array(envelopeBytes);
  const headerEnd = bytes.indexOf(0x0a);
  const headerBytes = headerEnd === -1 ? bytes : bytes.subarray(0, headerEnd);

  return new TextDecoder().decode(headerBytes);
}

function parseEnvelopeDsn(envelopeHeader: string): string {
  if (!envelopeHeader) {
    throw new Error('Sentry envelope must include a header');
  }

  const header = JSON.parse(envelopeHeader) as SentryEnvelopeHeader;

  if (typeof header.dsn !== 'string' || !header.dsn) {
    throw new Error('Sentry envelope must include a DSN');
  }

  return header.dsn;
}

export function buildSentryEnvelopeUrl({
  configuredDsn,
  envelopeHeader,
}: BuildSentryEnvelopeUrlOptions): string {
  const configured = parseSentryDsn(configuredDsn);
  const envelopeDsn = parseSentryDsn(parseEnvelopeDsn(envelopeHeader));
  const projectId = envelopeDsn.projectIds[0];

  if (envelopeDsn.host !== configured.host) {
    throw new Error(`Invalid Sentry hostname: ${envelopeDsn.host}`);
  }

  if (envelopeDsn.origin !== configured.origin) {
    throw new Error(`Invalid Sentry origin: ${envelopeDsn.origin}`);
  }

  if (envelopeDsn.pathPrefix !== configured.pathPrefix) {
    throw new Error(`Invalid Sentry path prefix: ${envelopeDsn.pathPrefix}`);
  }

  if (!projectId || !configured.projectIds.includes(projectId)) {
    throw new Error(`Invalid Sentry project id: ${projectId}`);
  }

  return `${configured.origin}${configured.pathPrefix}/api/${projectId}/envelope/`;
}
