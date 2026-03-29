export interface TestEmailLinks {
  verificationUrl: string | null;
  invitationUrl: string | null;
}

export function extractEmailLinks(react: { props?: unknown }): TestEmailLinks {
  const props = react.props as Record<string, unknown> | undefined;

  return {
    verificationUrl:
      props && typeof props.verificationUrl === 'string'
        ? props.verificationUrl
        : null,
    invitationUrl:
      props && typeof props.invitationUrl === 'string'
        ? props.invitationUrl
        : null,
  };
}
