export type ObservabilityContext = {
  requestId?: string;
  traceId?: string;
  route?: string;
  operation?: string;
  userId?: string;
  workspaceId?: string;
  statusCode?: number;
  durationMs?: number;
};

export function normalizeLogContext(
  context: ObservabilityContext
): Record<string, unknown> {
  const entries = Object.entries(context as Record<string, unknown>);
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
}

export function normalizeLogPayload(
  data?: unknown
): Record<string, unknown> | undefined {
  if (data === undefined) {
    return undefined;
  }

  if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
    return normalizeLogContext(data as ObservabilityContext);
  }

  return { data };
}
