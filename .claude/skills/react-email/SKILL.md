---
name: react-email
description: Build email templates as React components using React Email and @react-email/components. Covers template structure, components (Html, Head, Body, Container, Section, Row, Column, Text, Button, Link, Img, Hr, Heading, Preview, Font, Tailwind), layout patterns, styling, the render utility, the dev preview server, and email client compatibility. Use when the user asks to create email templates, build emails with React, style emails, preview emails, or work with @react-email/components.
---

# React Email

Build email templates as typed React components using `@react-email/components`.

## Setup

The package is already installed in this project. If starting fresh:

```bash
bun add @react-email/components
bun add -D react-email    # for the preview dev server
```

## File Conventions

Place email templates in `src/components/email/`:

```
src/components/email/
├── welcome-email.tsx
├── verification-code-email.tsx
├── password-reset-email.tsx
└── _components/              # shared partials (prefixed with _ to hide from preview)
    ├── email-header.tsx
    └── email-footer.tsx
```

- **Filename**: `kebab-case.tsx` — match project conventions.
- **Export**: Named PascalCase export (e.g., `WelcomeEmail`). Also add a `default` export for the preview server.
- **Props interface**: Define a typed props interface for every template.
- **PreviewProps**: Attach static `PreviewProps` to the default export for the dev server.

## Template Structure

Every email template follows this skeleton:

```tsx
import {
  Html,
  Head,
  Body,
  Preview,
  Tailwind,
  pixelBasedPreset,
  Container,
  Section,
  Text,
} from "@react-email/components";

interface WelcomeEmailProps {
  name: string;
  actionUrl: string;
}

export function WelcomeEmail({ name, actionUrl }: WelcomeEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Welcome to Acme, {name}!</Preview>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="bg-zinc-100 font-sans">
          <Container className="mx-auto max-w-[600px] bg-white p-8">
            <Section>
              <Text className="text-2xl font-bold text-zinc-900">
                Welcome, {name}!
              </Text>
              {/* template content */}
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

// Default export and preview props for the dev server.
export default WelcomeEmail;
WelcomeEmail.PreviewProps = {
  name: "Jane",
  actionUrl: "https://example.com/get-started",
} satisfies WelcomeEmailProps;
```

### Required wrapper order

1. `<Html>` — outermost, sets `lang` and `dir`.
2. `<Head />` — must be a direct child of `<Html>`.
3. `<Preview>` — inbox preview text (keep under 90 characters).
4. `<Tailwind>` — wraps `<Body>` to enable Tailwind classes.
5. `<Body>` — email body.
6. `<Container>` — centers content, sets max width.

## Components

All components are imported from `@react-email/components`.

### Layout

| Component | Purpose | Key props |
|-----------|---------|-----------|
| `Html` | Root wrapper | `lang`, `dir` |
| `Head` | Document head (fonts, styles) | — |
| `Body` | Email body | `style`, `className` |
| `Container` | Centered content wrapper (max-width) | `style`, `className` |
| `Section` | Groups related content (renders `<table>`) | `style`, `className` |
| `Row` | Table row inside `Section` | `style`, `className` |
| `Column` | Table cell inside `Row` | `style`, `className` |

### Content

| Component | Purpose | Key props |
|-----------|---------|-----------|
| `Text` | Paragraph of text | `style`, `className` |
| `Heading` | Heading (`h1`–`h6`) | `as` (`"h1"`–`"h6"`), `style` |
| `Link` | Hyperlink | `href`, `target` |
| `Button` | CTA link styled as a button | `href` (required), `target` |
| `Img` | Image | `src`, `alt`, `width`, `height` |
| `Hr` | Horizontal rule | `style`, `className` |
| `Preview` | Inbox preview text | children (string) |

### Typography & Code

| Component | Purpose | Key props |
|-----------|---------|-----------|
| `Font` | Load custom font in `<Head>` | `fontFamily`, `fallbackFontFamily`, `webFont` |
| `CodeBlock` | Syntax-highlighted code block | `code`, `language`, `theme` |
| `CodeInline` | Inline code | children |
| `Markdown` | Render markdown as email HTML | `children`, `markdownContainerStyles` |

### Styling

| Component | Purpose | Key props |
|-----------|---------|-----------|
| `Tailwind` | Enables Tailwind CSS classes | `config` |

## Styling with Tailwind

Wrap `<Body>` with `<Tailwind>` and use the `pixelBasedPreset` (email clients don't support `rem`):

```tsx
import { Tailwind, pixelBasedPreset } from "@react-email/components";

<Tailwind
  config={{
    presets: [pixelBasedPreset],
    theme: {
      extend: {
        colors: {
          brand: "#007291",
        },
      },
    },
  }}
>
  <Body className="bg-zinc-50 font-sans">
    {/* children */}
  </Body>
</Tailwind>
```

### Tailwind limitations in email

- Always use `pixelBasedPreset` — `rem` units break in many email clients.
- `space-*` utilities do not work (complex selectors can't be inlined).
- `prose` from `@tailwindcss/typography` is not supported.
- `hover:` styles have very limited email client support — avoid them.
- Context providers must go **above** `<Tailwind>`, not inside it.

### Inline styles fallback

For critical styles that must work everywhere, prefer inline `style` objects:

```tsx
<Text style={{ fontSize: "16px", lineHeight: "24px", color: "#27272a" }}>
  Hello
</Text>
```

## Inline Styles vs. Tailwind

| Use case | Recommendation |
|----------|---------------|
| General styling | Tailwind classes via `className` |
| Critical / Outlook-specific | Inline `style` objects |
| Custom brand colors | Extend Tailwind `theme.colors` |

## Layout Patterns

### Single column (most common)

```tsx
<Container className="mx-auto max-w-[600px]">
  <Section className="px-8 py-6">
    <Text>Content goes here</Text>
  </Section>
</Container>
```

### Two-column layout

```tsx
<Section>
  <Row>
    <Column className="w-1/2 pr-4">
      <Text>Left column</Text>
    </Column>
    <Column className="w-1/2 pl-4">
      <Text>Right column</Text>
    </Column>
  </Row>
</Section>
```

### Header + content + footer

```tsx
<Container className="mx-auto max-w-[600px] bg-white">
  {/* Header */}
  <Section className="bg-zinc-900 px-8 py-6">
    <Img src="https://cdn.example.com/logo.png" alt="Acme" width={120} height={40} />
  </Section>

  {/* Content */}
  <Section className="px-8 py-6">
    <Text>Main content</Text>
  </Section>

  {/* Footer */}
  <Section className="px-8 py-6">
    <Hr className="border-zinc-200" />
    <Text className="text-xs text-zinc-400">
      © 2026 Acme Inc. All rights reserved.
    </Text>
  </Section>
</Container>
```

## Custom Fonts

Load fonts inside `<Head>`:

```tsx
<Head>
  <Font
    fontFamily="Inter"
    fallbackFontFamily="Helvetica"
    webFont={{
      url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700",
      format: "woff2",
    }}
  />
</Head>
```

Not all email clients support web fonts — always set `fallbackFontFamily`.

## Rendering to HTML

Use `render` when sending emails outside of Resend's `react` prop:

```tsx
import { render, pretty, toPlainText } from "@react-email/render";
import { WelcomeEmail } from "@/components/email/welcome-email";

// Render to HTML string.
const html = await render(<WelcomeEmail name="Jane" actionUrl="https://example.com" />);

// Prettified HTML (useful for debugging).
const prettyHtml = await pretty(html);

// Plain text version.
const text = toPlainText(html);
```

When using Resend, prefer the `react` prop directly — no manual render needed:

```tsx
await resend.emails.send({
  from: "Acme <noreply@acme.com>",
  to: ["user@example.com"],
  subject: "Welcome!",
  react: <WelcomeEmail name="Jane" actionUrl="https://example.com" />,
});
```

## Preview Dev Server

Start the preview server to iterate on templates visually:

```bash
bunx react-email dev --dir src/components/email --port 3001
```

- Templates must have a `default` export to appear in the sidebar.
- Attach `PreviewProps` to inject sample data.
- Prefix directories with `_` to hide them from the sidebar (e.g., `_components/`).
- Static files go in `src/components/email/static/` and are served at `/static/...`.

For production images, use a conditional base URL:

```tsx
const baseUrl = process.env.NODE_ENV === "production"
  ? "https://cdn.example.com"
  : "";

<Img src={`${baseUrl}/static/logo.png`} alt="Logo" width={120} height={40} />;
```

## Common Template Patterns

### Verification code (OTP)

```tsx
export function VerificationCodeEmail({ code }: { code: string }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your verification code: {code}</Preview>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="bg-zinc-100 font-sans">
          <Container className="mx-auto max-w-[600px] bg-white p-8">
            <Text className="text-lg font-semibold text-zinc-900">
              Your verification code
            </Text>
            <Section className="my-6 rounded-md bg-zinc-100 px-6 py-4 text-center">
              <Text className="text-3xl font-bold tracking-widest text-zinc-900">
                {code}
              </Text>
            </Section>
            <Text className="text-sm text-zinc-500">
              This code expires in 10 minutes. If you didn't request this, ignore this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
```

### Password reset

```tsx
export function PasswordResetEmail({ resetUrl, name }: { resetUrl: string; name: string }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Reset your password</Preview>
      <Tailwind config={{ presets: [pixelBasedPreset] }}>
        <Body className="bg-zinc-100 font-sans">
          <Container className="mx-auto max-w-[600px] bg-white p-8">
            <Text className="text-lg text-zinc-900">Hi {name},</Text>
            <Text className="text-zinc-600">
              We received a request to reset your password. Click the button below to choose a new one.
            </Text>
            <Section className="my-6 text-center">
              <Button
                href={resetUrl}
                className="rounded-md bg-zinc-900 px-6 py-3 text-sm font-semibold text-white"
              >
                Reset Password
              </Button>
            </Section>
            <Text className="text-sm text-zinc-500">
              If you didn't request a password reset, you can safely ignore this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
```

## Email Client Compatibility Tips

- **Max width 600px** — the safe maximum for most email clients.
- **Use table-based layout** — `Section`, `Row`, `Column` render as `<table>` under the hood.
- **Avoid CSS Grid and Flexbox** — these are not supported in Outlook and many email clients.
- **Inline critical styles** — Outlook strips `<style>` tags in some cases.
- **Always set `width` and `height` on images** — prevents layout shifts.
- **Use absolute URLs for images** — relative paths break in email clients.
- **Test in multiple clients** — Gmail, Apple Mail, Outlook, Yahoo Mail at minimum.
- **Keep preview text under 90 characters** — it may be truncated.
- **Use web-safe fallback fonts** — `Helvetica`, `Arial`, `Georgia`, `Times New Roman`.

## Additional Resources

- For detailed component props and API, see [reference.md](reference.md).
- Official docs: https://react.email/docs
- Template gallery: https://demo.react.email
