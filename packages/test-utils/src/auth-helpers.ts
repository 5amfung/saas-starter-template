interface CreateVerifiedUserOptions {
  email: string;
  password: string;
  name?: string;
}

interface CreateVerifiedUserResult {
  userId: string;
  cookie: string;
}

/**
 * Signs up a new user and immediately verifies their email via the admin API.
 * Returns the session cookie for use in Playwright tests.
 *
 * Requires:
 * - The test server running with NODE_ENV=test
 * - A test admin user already created (adminEmail/adminPassword)
 */
export async function createVerifiedUser(
  baseUrl: string,
  options: CreateVerifiedUserOptions,
  admin: { email: string; password: string }
): Promise<CreateVerifiedUserResult> {
  // Step 1: Sign up the new user.
  const signupResponse = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: options.email,
      password: options.password,
      name: options.name ?? options.email.split('@')[0],
    }),
  });

  if (!signupResponse.ok) {
    const body = await signupResponse.text();
    throw new Error(`Sign-up failed (${signupResponse.status}): ${body}`);
  }

  const signupData = (await signupResponse.json()) as {
    user?: { id?: string };
  };
  const userId = signupData.user?.id;
  if (!userId) {
    throw new Error('Sign-up response did not include user ID');
  }

  // Step 2: Sign in as admin.
  const adminSigninResponse = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: admin.email,
      password: admin.password,
    }),
  });

  if (!adminSigninResponse.ok) {
    const body = await adminSigninResponse.text();
    throw new Error(
      `Admin sign-in failed (${adminSigninResponse.status}): ${body}`
    );
  }

  const adminCookies = adminSigninResponse.headers.get('set-cookie') ?? '';

  // Step 3: Use admin API to verify the user's email.
  const verifyResponse = await fetch(`${baseUrl}/api/auth/admin/update-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookies,
    },
    body: JSON.stringify({
      userId,
      data: { emailVerified: true },
    }),
  });

  if (!verifyResponse.ok) {
    const body = await verifyResponse.text();
    throw new Error(
      `Admin verify user failed (${verifyResponse.status}): ${body}`
    );
  }

  // Step 4: Sign in as the verified user to get their session cookie.
  const userSigninResponse = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: options.email,
      password: options.password,
    }),
  });

  if (!userSigninResponse.ok) {
    const body = await userSigninResponse.text();
    throw new Error(
      `User sign-in after verify failed (${userSigninResponse.status}): ${body}`
    );
  }

  const userCookie = userSigninResponse.headers.get('set-cookie') ?? '';

  return { userId, cookie: userCookie };
}
