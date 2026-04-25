describe('/api/messaging/hello route', () => {
  async function getPostHandler() {
    vi.resetModules();
    const { Route } = await import('@/routes/api/messaging/hello');
    const handlers = Route.options.server?.handlers as
      | {
          POST?: (args: {
            context: {
              jsonBody: {
                name: string;
                message: string;
              };
              workspaceApiKey: {
                keyId: string;
                workspaceId: string;
              };
            };
            request: Request;
          }) => Promise<Response>;
        }
      | undefined;

    return handlers?.POST;
  }

  it('returns the messaging hello response from the validated request context', async () => {
    const handler = await getPostHandler();
    const response = await handler!({
      context: {
        jsonBody: {
          name: 'Bob Doe',
          message: 'Hello',
        },
        workspaceApiKey: {
          keyId: 'key_1',
          workspaceId: 'ws_1',
        },
      },
      request: new Request('http://localhost/api/messaging/hello', {
        method: 'POST',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: 'Hello Bob Doe',
      workspace_id: 'ws_1',
    });
  });
});
