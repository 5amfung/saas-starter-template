/**
 * Returns the user's initials based on their name; if unavailable, derives from
 * email. Fallbacks to '??'.
 */
export function getInitials(name: string, email?: string): string {
  const cleaned = name.trim();

  // Option 1: If name has two or more words, use the first char of first and last word.
  if (cleaned.length >= 2) {
    const parts = cleaned.split(/\s+/);
    if (parts.length >= 2) {
      const first = parts[0].charAt(0);
      const last = parts[parts.length - 1].charAt(0);
      if (first && last) {
        return (first + last).toUpperCase();
      }
    }
  }

  // Option 2: If name option 1 failed and email provided,
  // split local part by special chars and use first and last char if multisegment
  if (email) {
    const local = email.split('@')[0] ?? '';
    const emailParts = local.split(/[._-]+/);
    if (emailParts.length >= 2) {
      const first = emailParts[0].charAt(0);
      const last = emailParts[emailParts.length - 1].charAt(0);
      if (first && last) {
        return (first + last).toUpperCase();
      }
    }
  }

  // Option 3: Take the first two characters of name, else email, if possible
  if (cleaned.length >= 2) {
    return cleaned.slice(0, 2).toUpperCase();
  }
  if (email) {
    const local = email.split('@')[0] ?? '';
    if (local.length >= 2) {
      return local.slice(0, 2).toUpperCase();
    }
  }

  return '??';
}
