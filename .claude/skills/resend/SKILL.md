---
name: resend
description: Send transactional and marketing emails using the Resend Node.js SDK. Covers sending single/batch emails, React Email templates, contacts, segments, broadcasts, domains, webhooks, and templates. Use when the user asks to send emails, create email templates, manage contacts or segments, set up broadcasts, configure domains, or integrate Resend into their application.
---

# Resend

## Setup

Install the SDK and React Email (if using React templates):

```bash
bun add resend
bun add react-email @react-email/components  # optional, for React templates
```

Store the API key in `.env`:

```
RESEND_API_KEY=re_xxxxxxxxx
```

Create a shared client instance:

```typescript
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
```

## Sending Emails

### Single email

```typescript
const { data, error } = await resend.emails.send({
  from: "Acme <noreply@acme.com>",
  to: ["user@example.com"],
  subject: "Welcome!",
  html: "<p>Hello world</p>",
});
```

### With React Email template

```typescript
import { WelcomeEmail } from "@/emails/welcome";

const { data, error } = await resend.emails.send({
  from: "Acme <noreply@acme.com>",
  to: ["user@example.com"],
  subject: "Welcome!",
  react: <WelcomeEmail name="John" />,
});
```

### With a stored template

```typescript
const { data, error } = await resend.emails.send({
  from: "Acme <noreply@acme.com>",
  to: ["user@example.com"],
  subject: "Welcome!",
  template: {
    id: "template-id-or-alias",
    variables: { CTA: "Sign up", CTA_LINK: "https://acme.com/signup" },
  },
});
```

### Batch emails (up to 100 per call)

```typescript
const { data, error } = await resend.batch.send([
  {
    from: "Acme <noreply@acme.com>",
    to: ["user1@example.com"],
    subject: "Hello User 1",
    html: "<p>Personalized for user 1</p>",
  },
  {
    from: "Acme <noreply@acme.com>",
    to: ["user2@example.com"],
    subject: "Hello User 2",
    html: "<p>Personalized for user 2</p>",
  },
]);
// Note: batch does not support attachments or scheduled_at.
```

### Common send options

| Option | Type | Notes |
|---|---|---|
| `from` | `string` | Required. `"Name <email>"` format. |
| `to` | `string \| string[]` | Required. Max 50 recipients. |
| `subject` | `string` | Required. |
| `html` | `string` | HTML body. Mutually exclusive with `react` and `template`. |
| `react` | `ReactNode` | React component body (Node.js SDK only). |
| `template` | `{ id, variables }` | Stored template. Mutually exclusive with `html`/`react`. |
| `text` | `string` | Plain text fallback. Auto-generated from HTML if omitted. |
| `cc` / `bcc` | `string \| string[]` | Carbon copy / blind carbon copy. |
| `replyTo` | `string \| string[]` | Reply-to address(es). |
| `headers` | `object` | Custom email headers. |
| `tags` | `{ name, value }[]` | Tracking tags (ASCII, max 256 chars each). |
| `attachments` | `{ content, filename, path }[]` | Max 40 MB total after Base64. |

### Manage sent emails

```typescript
// Retrieve a single email.
const { data } = await resend.emails.get("email-id");

// List sent emails.
const { data } = await resend.emails.list();

// Cancel a scheduled email.
const { data } = await resend.emails.cancel("email-id");
```

## Contacts

```typescript
// Create a contact.
const { data } = await resend.contacts.create({
  email: "user@example.com",
  firstName: "Jane",
  lastName: "Doe",
  unsubscribed: false,
  segments: [{ id: "segment-id" }],
});

// List contacts.
const { data } = await resend.contacts.list();

// Update a contact.
const { data } = await resend.contacts.update({
  id: "contact-id",
  unsubscribed: true,
});

// Delete a contact.
const { data } = await resend.contacts.remove("contact-id");
```

## Segments

Segments replace the deprecated Audiences API.

```typescript
// Create a segment.
const { data } = await resend.segments.create({
  name: "Newsletter Subscribers",
});

// List segments.
const { data } = await resend.segments.list();

// Delete a segment.
const { data } = await resend.segments.remove("segment-id");
```

## Broadcasts

Two-step process: create the broadcast, then send it.

```typescript
// Step 1: Create the broadcast.
const { data: broadcast } = await resend.broadcasts.create({
  segmentId: "segment-id",
  from: "Acme <newsletter@acme.com>",
  subject: "March Newsletter",
  html: 'Hi {{{FIRST_NAME|there}}}, unsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}',
});

// Step 2: Send the broadcast.
const { data } = await resend.broadcasts.send(broadcast.id);
```

Broadcast template variables use triple-brace syntax: `{{{VARIABLE|fallback}}}`.
Reserved variables: `FIRST_NAME`, `LAST_NAME`, `EMAIL`, `RESEND_UNSUBSCRIBE_URL`.

## Domains

```typescript
// Register a domain.
const { data } = await resend.domains.create({
  name: "acme.com",
  region: "us-east-1", // us-east-1 | eu-west-1 | sa-east-1 | ap-northeast-1
});
// Returns DNS records (SPF, DKIM) to add to your DNS provider.

// Trigger verification after DNS records are set.
const { data } = await resend.domains.verify("domain-id");

// List all domains.
const { data } = await resend.domains.list();
```

## Webhooks

```typescript
const { data } = await resend.webhooks.create({
  url: "https://acme.com/api/webhooks/resend",
  events: [
    "email.sent",
    "email.delivered",
    "email.bounced",
    "email.complained",
    "email.opened",
    "email.clicked",
  ],
});
```

## Error Handling

Every SDK method returns `{ data, error }`. Always check for errors:

```typescript
const { data, error } = await resend.emails.send({ /* ... */ });

if (error) {
  // error.name — error code (e.g., "validation_error", "rate_limit_exceeded").
  // error.message — human-readable description.
  console.error(`Resend error [${error.name}]: ${error.message}`);
  return;
}

console.log("Email sent:", data.id);
```

### Rate limits

Default rate limit is 2 requests/second/team. Use batch sending to reduce API calls. Use idempotency keys to prevent duplicate sends:

```typescript
const { data } = await resend.emails.send(
  { from: "...", to: ["..."], subject: "...", html: "..." },
  { headers: { "Idempotency-Key": "unique-key-per-request" } },
);
```

## React Email Templates

Create email templates as React components in an `emails/` directory:

```typescript
// emails/welcome.tsx
import { Html, Head, Body, Container, Text, Button } from "@react-email/components";

interface WelcomeEmailProps {
  name: string;
  actionUrl: string;
}

export function WelcomeEmail({ name, actionUrl }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "sans-serif" }}>
        <Container>
          <Text>Welcome, {name}!</Text>
          <Button href={actionUrl}>Get Started</Button>
        </Container>
      </Body>
    </Html>
  );
}
```

Preview templates locally: `bunx react-email dev`

## Additional Resources

- For the complete API endpoint reference, see [reference.md](reference.md).
