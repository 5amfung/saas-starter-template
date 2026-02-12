# React Email — Component Reference

Detailed props and usage for every `@react-email/components` component.

## Html

Root element wrapping the entire email.

```tsx
<Html lang="en" dir="ltr">
  {/* Head, Preview, Body */}
</Html>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `lang` | `string` | `"en"` | Language of the email content. |
| `dir` | `string` | `"ltr"` | Text direction (`"ltr"` or `"rtl"`). |

## Head

Document `<head>` for metadata, fonts, and styles. Must be a direct child of `<Html>`.

```tsx
<Html>
  <Head>
    <Font fontFamily="Inter" fallbackFontFamily="Helvetica" webFont={{ url: "...", format: "woff2" }} />
  </Head>
</Html>
```

No additional props — it accepts children (e.g., `<Font>`, `<style>` tags).

## Preview

Inbox preview text shown before opening the email. Keep under 90 characters.

```tsx
<Preview>Your order has shipped!</Preview>
```

Accepts only string children.

## Body

The `<body>` element of the email.

```tsx
<Body style={{ backgroundColor: "#f4f4f5", fontFamily: "sans-serif" }}>
  {/* Container */}
</Body>
```

| Prop | Type | Description |
|------|------|-------------|
| `style` | `React.CSSProperties` | Inline styles. |
| `className` | `string` | Tailwind / CSS class names. |

## Container

Centers content and constrains width. Renders as a `<table>`.

```tsx
<Container className="mx-auto max-w-[600px] bg-white p-8">
  {/* Sections */}
</Container>
```

| Prop | Type | Description |
|------|------|-------------|
| `style` | `React.CSSProperties` | Inline styles. |
| `className` | `string` | Tailwind / CSS class names. |

## Section

Groups content. Renders as a `<table>`. Use `Row` and `Column` inside for multi-column layout.

```tsx
<Section className="px-8 py-6">
  <Text>Single column content</Text>
</Section>

<Section>
  <Row>
    <Column>Left</Column>
    <Column>Right</Column>
  </Row>
</Section>
```

## Row

A table row inside a `Section`. Contains `Column` children.

```tsx
<Row>
  <Column className="w-1/2">Col 1</Column>
  <Column className="w-1/2">Col 2</Column>
</Row>
```

## Column

A table cell inside a `Row`.

```tsx
<Column style={{ width: "50%", verticalAlign: "top" }}>
  <Text>Content</Text>
</Column>
```

## Text

Block of text. Renders as a `<p>` tag with default styles:
`font-size: 14px; line-height: 24px; margin: 16px 0`.

```tsx
<Text className="text-base text-zinc-900">Hello world</Text>
```

## Heading

Renders `<h1>` through `<h6>`.

```tsx
<Heading as="h2" className="text-xl font-bold text-zinc-900">
  Section Title
</Heading>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `as` | `"h1"` \| `"h2"` \| `"h3"` \| `"h4"` \| `"h5"` \| `"h6"` | `"h1"` | Heading level. |

## Button

A link (`<a>`) styled to look like a button. Always requires `href`.

```tsx
<Button
  href="https://example.com/activate"
  className="rounded-md bg-zinc-900 px-5 py-3 text-sm font-semibold text-white"
>
  Activate Account
</Button>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `href` | `string` | — | **Required.** URL the button links to. |
| `target` | `string` | `"_blank"` | Link target attribute. |

## Link

Hyperlink. Renders as `<a>`.

```tsx
<Link href="https://example.com" className="text-blue-600 underline">
  Visit our site
</Link>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `href` | `string` | — | **Required.** URL. |
| `target` | `string` | `"_blank"` | Link target. |

## Img

Image element. Always set `width`, `height`, and use absolute `src` URLs.

```tsx
<Img
  src="https://cdn.example.com/hero.png"
  alt="Hero image"
  width={600}
  height={300}
  className="w-full"
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `src` | `string` | **Required.** Absolute image URL. |
| `alt` | `string` | Alt text for accessibility. |
| `width` | `number` | Image width in pixels. |
| `height` | `number` | Image height in pixels. |

## Hr

Horizontal rule. Default: `width: 100%; border: none; border-top: 1px solid #eaeaea`.

```tsx
<Hr className="my-6 border-zinc-200" />
```

## Font

Loads a custom web font. Must be placed inside `<Head>`.

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

| Prop | Type | Description |
|------|------|-------------|
| `fontFamily` | `string` | Name of the font family. |
| `fallbackFontFamily` | `string` | Web-safe fallback font. |
| `webFont` | `{ url: string; format: string }` | Web font source. |

## CodeBlock

Syntax-highlighted code block.

```tsx
import { CodeBlock, dracula } from "@react-email/components";

<CodeBlock code="const x = 42;" language="javascript" theme={dracula} />
```

| Prop | Type | Description |
|------|------|-------------|
| `code` | `string` | Code content. |
| `language` | `string` | Language for syntax highlighting. |
| `theme` | `object` | Syntax theme (import from `@react-email/components`). |

## CodeInline

Inline code styling.

```tsx
<Text>
  Run <CodeInline>npm install</CodeInline> to install dependencies.
</Text>
```

## Markdown

Render markdown content as email-safe HTML.

```tsx
<Markdown markdownContainerStyles={{ padding: "12px", backgroundColor: "#f4f4f5" }}>
  {`# Hello\n\nThis is **bold** text.`}
</Markdown>
```

| Prop | Type | Description |
|------|------|-------------|
| `children` | `string` | Markdown content. |
| `markdownContainerStyles` | `React.CSSProperties` | Container styles. |

## Tailwind

Wraps content to enable Tailwind CSS classes. Place around `<Body>`.

```tsx
import { Tailwind, pixelBasedPreset } from "@react-email/components";

<Tailwind
  config={{
    presets: [pixelBasedPreset],
    theme: {
      extend: {
        colors: { brand: "#007291" },
      },
    },
  }}
>
  <Body>{/* content */}</Body>
</Tailwind>
```

| Prop | Type | Description |
|------|------|-------------|
| `config` | `object` | Tailwind configuration object. |

### Important notes

- Always include `pixelBasedPreset` — converts `rem` to `px` for email client support.
- `space-*` and `prose` utilities are not supported.
- `hover:` variants have very limited support across email clients.
- Place React context providers **above** `<Tailwind>`, not inside it.

## render

Converts a React Email component to an HTML string. Import from `@react-email/render`.

```tsx
import { render, pretty, toPlainText } from "@react-email/render";

const html = await render(<MyEmail {...props} />);
const prettyHtml = await pretty(html);
const text = toPlainText(html);
```

| Function | Returns | Description |
|----------|---------|-------------|
| `render(element)` | `Promise<string>` | Renders to HTML string. |
| `pretty(html)` | `Promise<string>` | Beautifies HTML output. |
| `toPlainText(html)` | `string` | Converts HTML to plain text. |
