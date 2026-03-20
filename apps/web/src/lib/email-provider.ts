interface WebmailProviderLink {
  label: string;
  href: string;
}

const WEBMAIL_PROVIDER_BY_DOMAIN: Record<string, WebmailProviderLink> = {
  'gmail.com': {
    label: 'Gmail',
    href: 'https://mail.google.com/',
  },
  'googlemail.com': {
    label: 'Gmail',
    href: 'https://mail.google.com/',
  },
  'outlook.com': {
    label: 'Outlook',
    href: 'https://outlook.live.com/mail/',
  },
  'hotmail.com': {
    label: 'Outlook',
    href: 'https://outlook.live.com/mail/',
  },
  'live.com': {
    label: 'Outlook',
    href: 'https://outlook.live.com/mail/',
  },
  'msn.com': {
    label: 'Outlook',
    href: 'https://outlook.live.com/mail/',
  },
  'yahoo.com': {
    label: 'Yahoo Mail',
    href: 'https://mail.yahoo.com/',
  },
  'icloud.com': {
    label: 'iCloud Mail',
    href: 'https://www.icloud.com/mail/',
  },
  'me.com': {
    label: 'iCloud Mail',
    href: 'https://www.icloud.com/mail/',
  },
  'mac.com': {
    label: 'iCloud Mail',
    href: 'https://www.icloud.com/mail/',
  },
  'proton.me': {
    label: 'Proton Mail',
    href: 'https://mail.proton.me/',
  },
  'protonmail.com': {
    label: 'Proton Mail',
    href: 'https://mail.proton.me/',
  },
  'aol.com': {
    label: 'AOL Mail',
    href: 'https://mail.aol.com/',
  },
};

function getEmailDomain(email: string) {
  const trimmedEmail = email.trim().toLowerCase();
  const lastAtIndex = trimmedEmail.lastIndexOf('@');

  if (lastAtIndex <= 0 || lastAtIndex === trimmedEmail.length - 1) {
    return null;
  }

  return trimmedEmail.slice(lastAtIndex + 1);
}

export function getWebmailLinkForEmail(email: string) {
  const domain = getEmailDomain(email);

  if (!domain) {
    return null;
  }

  return WEBMAIL_PROVIDER_BY_DOMAIN[domain] ?? null;
}
