import { createMessagingHello } from '@/api/messaging/service.server';

describe('messaging service', () => {
  it('builds the hello response from the request message and name', () => {
    expect(
      createMessagingHello({
        input: {
          name: 'Bob Doe',
          message: 'Hello',
        },
        workspaceId: 'ws_1',
      })
    ).toEqual({
      message: 'Hello Bob Doe',
      workspace_id: 'ws_1',
    });
  });
});
