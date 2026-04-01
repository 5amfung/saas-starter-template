export function toFieldErrorItem(error: unknown): { message: string } {
  if (typeof error === 'string') return { message: error };
  if (error && typeof error === 'object' && 'message' in error) {
    return error as { message: string };
  }
  return { message: 'Validation error.' };
}
