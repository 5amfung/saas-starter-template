# Resend API Reference

Base URL: `https://api.resend.com`
Auth: `Authorization: Bearer re_xxxxxxxxx`
Rate limit: 2 req/s per team. Responses: `2xx` success, `4xx` client error, `5xx` server error.

## Emails

| Method | Endpoint | SDK Method | Description |
|---|---|---|---|
| POST | `/emails` | `resend.emails.send(payload)` | Send a single email. |
| POST | `/emails/batch` | `resend.batch.send(payload[])` | Send up to 100 emails. No attachments or scheduling. |
| GET | `/emails/{id}` | `resend.emails.get(id)` | Retrieve email by ID. |
| GET | `/emails` | `resend.emails.list()` | List sent emails. |
| PATCH | `/emails/{id}` | `resend.emails.update({ id, ... })` | Update a scheduled email. |
| POST | `/emails/{id}/cancel` | `resend.emails.cancel(id)` | Cancel a scheduled email. |

### Send email payload

```typescript
{
  from: string;             // Required. "Name <email>" format.
  to: string | string[];    // Required. Max 50.
  subject: string;          // Required.
  html?: string;            // HTML body.
  text?: string;            // Plain text body.
  react?: ReactNode;        // React component (Node.js only).
  template?: {              // Stored template (mutually exclusive with html/react).
    id: string;
    variables?: Record<string, string | number>;
  };
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string | string[];
  headers?: Record<string, string>;
  tags?: { name: string; value: string }[];
  attachments?: {
    content?: string;       // Base64 string or buffer.
    filename?: string;
    path?: string;          // Remote URL.
  }[];
  scheduledAt?: string;     // ISO 8601 or natural language.
}
```

Reserved template variable names: `FIRST_NAME`, `LAST_NAME`, `EMAIL`, `UNSUBSCRIBE_URL`.

## Contacts

| Method | Endpoint | SDK Method |
|---|---|---|
| POST | `/contacts` | `resend.contacts.create(payload)` |
| GET | `/contacts/{id}` | `resend.contacts.get(id)` |
| GET | `/contacts` | `resend.contacts.list()` |
| PATCH | `/contacts/{id}` | `resend.contacts.update({ id, ... })` |
| DELETE | `/contacts/{id}` | `resend.contacts.remove(id)` |
| POST | `/contacts/{id}/segments` | `resend.contacts.addToSegment(id, segmentId)` |
| GET | `/contacts/{id}/segments` | `resend.contacts.listSegments(id)` |
| DELETE | `/contacts/{id}/segments/{segmentId}` | `resend.contacts.removeFromSegment(id, segmentId)` |

### Create contact payload

```typescript
{
  email: string;                          // Required.
  unsubscribed?: boolean;
  properties?: Record<string, string>;    // Custom properties.
  segments?: { id: string }[];            // Segments to add to.
  topics?: { id: string; subscription: "opt_in" | "opt_out" }[];
}
```

## Segments

Segments replace the deprecated Audiences API.

| Method | Endpoint | SDK Method |
|---|---|---|
| POST | `/segments` | `resend.segments.create({ name })` |
| GET | `/segments/{id}` | `resend.segments.get(id)` |
| GET | `/segments` | `resend.segments.list()` |
| DELETE | `/segments/{id}` | `resend.segments.remove(id)` |

## Broadcasts

| Method | Endpoint | SDK Method |
|---|---|---|
| POST | `/broadcasts` | `resend.broadcasts.create(payload)` |
| POST | `/broadcasts/{id}/send` | `resend.broadcasts.send(id)` |
| GET | `/broadcasts/{id}` | `resend.broadcasts.get(id)` |
| GET | `/broadcasts` | `resend.broadcasts.list()` |
| PATCH | `/broadcasts/{id}` | `resend.broadcasts.update({ id, ... })` |
| DELETE | `/broadcasts/{id}` | `resend.broadcasts.remove(id)` |

### Create broadcast payload

```typescript
{
  segmentId: string;        // Required. Target segment.
  from: string;             // Required.
  subject: string;          // Required.
  html?: string;            // Supports {{{VARIABLE|fallback}}} syntax.
  text?: string;
  react?: ReactNode;
  name?: string;            // Internal reference name.
}
```

## Domains

| Method | Endpoint | SDK Method |
|---|---|---|
| POST | `/domains` | `resend.domains.create({ name, region? })` |
| POST | `/domains/{id}/verify` | `resend.domains.verify(id)` |
| GET | `/domains/{id}` | `resend.domains.get(id)` |
| GET | `/domains` | `resend.domains.list()` |
| PATCH | `/domains/{id}` | `resend.domains.update({ id, ... })` |
| DELETE | `/domains/{id}` | `resend.domains.remove(id)` |

Regions: `us-east-1` (default), `eu-west-1`, `sa-east-1`, `ap-northeast-1`.
TLS options: `opportunistic` (default), `enforced`.
Capabilities: `sending` (default: enabled), `receiving` (default: disabled).

## Topics

| Method | Endpoint | SDK Method |
|---|---|---|
| POST | `/topics` | `resend.topics.create({ name })` |
| GET | `/topics/{id}` | `resend.topics.get(id)` |
| GET | `/topics` | `resend.topics.list()` |
| PATCH | `/topics/{id}` | `resend.topics.update({ id, name })` |
| DELETE | `/topics/{id}` | `resend.topics.remove(id)` |

## Templates

| Method | Endpoint | SDK Method |
|---|---|---|
| POST | `/templates` | `resend.templates.create(payload)` |
| GET | `/templates/{id}` | `resend.templates.get(id)` |
| GET | `/templates` | `resend.templates.list()` |
| PATCH | `/templates/{id}` | `resend.templates.update({ id, ... })` |
| DELETE | `/templates/{id}` | `resend.templates.remove(id)` |
| POST | `/templates/{id}/publish` | `resend.templates.publish(id)` |
| POST | `/templates/{id}/duplicate` | `resend.templates.duplicate(id)` |

## API Keys

| Method | Endpoint | SDK Method |
|---|---|---|
| POST | `/api-keys` | `resend.apiKeys.create({ name })` |
| GET | `/api-keys` | `resend.apiKeys.list()` |
| DELETE | `/api-keys/{id}` | `resend.apiKeys.remove(id)` |

## Webhooks

| Method | Endpoint | SDK Method |
|---|---|---|
| POST | `/webhooks` | `resend.webhooks.create({ url, events })` |
| GET | `/webhooks/{id}` | `resend.webhooks.get(id)` |
| GET | `/webhooks` | `resend.webhooks.list()` |
| PATCH | `/webhooks/{id}` | `resend.webhooks.update({ id, ... })` |
| DELETE | `/webhooks/{id}` | `resend.webhooks.remove(id)` |

### Webhook event types

- `email.sent`
- `email.delivered`
- `email.delivery_delayed`
- `email.bounced`
- `email.complained`
- `email.opened`
- `email.clicked`

## Audiences (Deprecated)

Use Segments instead. See: https://resend.com/docs/dashboard/segments/migrating-from-audiences-to-segments

| Method | Endpoint | SDK Method |
|---|---|---|
| POST | `/audiences` | `resend.audiences.create({ name })` |
| GET | `/audiences/{id}` | `resend.audiences.get(id)` |
| GET | `/audiences` | `resend.audiences.list()` |
| DELETE | `/audiences/{id}` | `resend.audiences.remove(id)` |
