export type BillingDomainErrorCode =
  | 'LIMIT_EXCEEDED'
  | 'FEATURE_NOT_ENABLED'
  | 'CHECKOUT_NOT_ALLOWED'
  | 'CONTACT_SALES_REQUIRED'
  | 'INVALID_OVERRIDE_PAYLOAD'
  | 'WORKSPACE_NOT_FOUND';

export class BillingDomainError extends Error {
  code: BillingDomainErrorCode;
  metadata?: Record<string, unknown>;

  constructor(
    code: BillingDomainErrorCode,
    message: string,
    metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BillingDomainError';
    this.code = code;
    this.metadata = metadata;
  }
}
