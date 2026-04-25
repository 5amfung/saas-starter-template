export function jsonError(
  message: string,
  status: number,
  headers?: HeadersInit
): Response {
  return Response.json(
    { error: message },
    {
      headers,
      status,
    }
  );
}
