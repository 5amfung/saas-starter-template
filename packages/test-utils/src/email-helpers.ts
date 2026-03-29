interface CapturedEmail {
  to: string;
  subject: string;
  verificationUrl: string | null;
  invitationUrl: string | null;
  sentAt: string;
}

export type TestEmailMatcher = (email: CapturedEmail) => boolean;

/**
 * Fetches captured emails from the test-only API route.
 *
 * Retries with a short delay because the email may not be captured
 * instantly after form submission.
 */
export async function getTestEmails(
  baseURL: string,
  to: string,
  maxRetries = 5
): Promise<Array<CapturedEmail>> {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(
      `${baseURL}/api/test/emails?to=${encodeURIComponent(to)}`
    );
    const data = (await response.json()) as { emails: Array<CapturedEmail> };
    if (data.emails.length > 0) return data.emails;
    await new Promise((r) => setTimeout(r, 500));
  }
  return [];
}

/**
 * Waits for a specific captured email to appear for a recipient.
 *
 * This is useful when the inbox may already contain unrelated emails and
 * callers need to wait for a newly-sent message that matches a predicate.
 */
export async function waitForTestEmail(
  baseURL: string,
  to: string,
  matcher: TestEmailMatcher,
  maxRetries = 5
): Promise<CapturedEmail | null> {
  for (let i = 0; i < maxRetries; i++) {
    const emails = await getTestEmails(baseURL, to, 1);
    const matchedEmail = emails.find(matcher);

    if (matchedEmail) {
      return matchedEmail;
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  return null;
}
