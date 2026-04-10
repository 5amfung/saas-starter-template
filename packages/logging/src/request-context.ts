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
