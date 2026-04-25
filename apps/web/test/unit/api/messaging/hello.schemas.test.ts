import { messagingHelloRequestSchema } from '@/api/messaging/hello.schemas';

describe('messaging hello schema', () => {
  it('accepts a valid hello request payload', () => {
    expect(
      messagingHelloRequestSchema.parse({
        name: 'Bob Doe',
        message: 'Hello',
      })
    ).toEqual({
      name: 'Bob Doe',
      message: 'Hello',
    });
  });

  it('rejects an empty name', () => {
    expect(() =>
      messagingHelloRequestSchema.parse({
        name: '',
        message: 'Hello',
      })
    ).toThrow();
  });
});
