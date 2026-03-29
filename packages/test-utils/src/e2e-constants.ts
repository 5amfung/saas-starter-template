/** Default password used by all E2E test accounts. */
export const VALID_PASSWORD = 'TestPassword123!';

/** Stripe test card details for checkout flows. */
export const STRIPE_TEST_CARD = {
  number: '4242424242424242',
  expiry: '01/2030',
  cvc: '123',
  name: 'Jane Doe',
  email: 'jane.doe@example.com',
  zip: '94103',
} as const;
