interface SignInSeededUserOptions {
  email: string;
  password: string;
}

interface SignInSeededUserResult {
  cookie: string;
}

export async function signInSeededUser(
  baseUrl: string,
  options: SignInSeededUserOptions
): Promise<SignInSeededUserResult> {
  const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: baseUrl,
    },
    body: JSON.stringify({
      email: options.email,
      password: options.password,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Seeded sign-in failed (${response.status}): ${body}`);
  }

  return {
    cookie: response.headers.get('set-cookie') ?? '',
  };
}
