import { waitForTestEmail } from './email-helpers';

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
 * Drains a response body to release the underlying TCP socket.
 * Must be called on every Response whose body won't be read.
 */
async function drain(response: Response): Promise<void> {
  await response.body?.cancel();
}

/** Retries a fetch call on transient failures (network errors, 5xx). */
async function fetchWithRetry(
  input: string | URL | Request,
  init?: RequestInit,
  maxRetries = 3
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(input, init);
      if (response.status >= 500 && attempt < maxRetries - 1) {
        await drain(response);
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw new Error('fetchWithRetry: unreachable');
}

/**
 * Signs up a new user, verifies their email via the test email API, and
 * returns the session cookie for use in Playwright tests.
 */
export async function createVerifiedUser(
  baseUrl: string,
  options: CreateVerifiedUserOptions
): Promise<CreateVerifiedUserResult> {
  // Step 1: Sign up the new user.
  const signupResponse = await fetchWithRetry(
    `${baseUrl}/api/auth/sign-up/email`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: baseUrl,
      },
      body: JSON.stringify({
        email: options.email,
        password: options.password,
        name: options.name ?? options.email.split('@')[0],
      }),
    }
  );

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

  // Step 2: Fetch the verification URL from the captured test email.
  const verificationEmail = await waitForTestEmail(
    baseUrl,
    options.email,
    (email) => Boolean(email.verificationUrl),
    20
  );
  const verificationUrl = verificationEmail?.verificationUrl;
  if (!verificationUrl) {
    throw new Error(`No verification email captured for ${options.email}.`);
  }

  // Step 3: Visit the verification URL to verify the email.
  const verifyResponse = await fetchWithRetry(verificationUrl, {
    redirect: 'manual',
  });
  if (verifyResponse.status !== 302 && !verifyResponse.ok) {
    const body = await verifyResponse.text();
    throw new Error(
      `Email verification failed (${verifyResponse.status}): ${body}`
    );
  }
  // Drain the body to release the TCP socket (302 redirects still have a body).
  await drain(verifyResponse);

  // Step 4: Sign in as the verified user to get their session cookie.
  const userSigninResponse = await fetchWithRetry(
    `${baseUrl}/api/auth/sign-in/email`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: baseUrl,
      },
      body: JSON.stringify({
        email: options.email,
        password: options.password,
      }),
    }
  );

  if (!userSigninResponse.ok) {
    const body = await userSigninResponse.text();
    throw new Error(
      `User sign-in after verify failed (${userSigninResponse.status}): ${body}`
    );
  }

  const userCookie = userSigninResponse.headers.get('set-cookie') ?? '';
  // Drain the body to release the TCP socket.
  await drain(userSigninResponse);

  return { userId, cookie: userCookie };
}
