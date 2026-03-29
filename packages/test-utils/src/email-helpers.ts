interface CapturedEmail {
  to: string;
  subject: string;
  verificationUrl: string | null;
  sentAt: string;
}

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
