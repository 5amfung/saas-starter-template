import { extractEmailLinks } from '@/lib';

describe('extractEmailLinks', () => {
  it('returns invitationUrl from invitation email props', () => {
    const links = extractEmailLinks({
      props: {
        invitationUrl: 'http://localhost:3000/accept-invite?id=inv_123',
      },
    });

    expect(links).toEqual({
      verificationUrl: null,
      invitationUrl: 'http://localhost:3000/accept-invite?id=inv_123',
    });
  });
});
