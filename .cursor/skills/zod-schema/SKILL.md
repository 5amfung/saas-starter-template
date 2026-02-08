---
name: zod-schema
description: Create data schemas and validate data using Zod v4. Covers schema definition, parsing, error handling, coercion, metadata, JSON Schema conversion, and common patterns. Use when the user asks to define schemas, validate data, create types with Zod, or work with runtime type checking in TypeScript.
---

# Zod Schema & Validation (v4)

Use Zod v4 (`zod@^4.0.0`) for all schema definitions. Do NOT use Zod v3 patterns.

## Installation

```bash
npm install zod@^4.0.0
```

Import:

```ts
import * as z from "zod";
```

## Defining Schemas

### Primitives

```ts
z.string();
z.number();
z.boolean();
z.bigint();
z.date();
z.undefined();
z.null();
z.void();
z.any();
z.unknown();
z.never();
```

### Numbers

```ts
z.number().min(1).max(100);
z.number().positive();
z.number().nonnegative();
z.number().multipleOf(5);

// Fixed-width numeric types.
z.int();      // safe integer range
z.float32();
z.float64();
z.int32();
z.uint32();
z.int64();    // returns ZodBigInt
z.uint64();   // returns ZodBigInt
```

### Strings — use top-level formats (NOT methods)

```ts
// Correct (v4).
z.email();
z.url();
z.uuidv4();
z.uuidv7();
z.ipv4();
z.ipv6();
z.base64();
z.jwt();
z.iso.date();
z.iso.datetime();
z.iso.time();
z.iso.duration();

// Deprecated (v3 style) — do NOT use.
// z.string().email()
// z.string().url()
```

String constraints still use methods:

```ts
z.string().min(1).max(255);
z.string().startsWith("https://");
z.string().includes("@");
z.string().regex(/^[a-z]+$/);
z.string().trim();
z.string().toLowerCase();
z.string().toUpperCase();
```

### Objects

```ts
const UserSchema = z.object({
  name: z.string(),
  email: z.email(),
  age: z.number().int().positive(),
});

type User = z.infer<typeof UserSchema>;
```

Object variants:

```ts
z.strictObject({ name: z.string() });  // rejects unknown keys
z.looseObject({ name: z.string() });   // passes through unknown keys
```

Object manipulation:

```ts
UserSchema.pick({ name: true });
UserSchema.omit({ age: true });
UserSchema.partial();
UserSchema.required();

// Extend with .extend() or spread (best tsc performance).
UserSchema.extend({ role: z.string() });
z.object({ ...UserSchema.shape, role: z.string() });
```

### Arrays & Tuples

```ts
z.array(z.string()).min(1).max(10);
z.tuple([z.string(), z.number()]);
z.tuple([z.string()], z.string());  // [string, ...string[]]
```

### Unions & Discriminated Unions

```ts
z.union([z.string(), z.number()]);

z.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), data: z.string() }),
  z.object({ status: z.literal("error"), message: z.string() }),
]);
```

### Enums

```ts
// String enums.
z.enum(["admin", "user", "guest"]);

// Native TypeScript enums.
enum Role { Admin = "admin", User = "user" }
z.enum(Role);
```

### Records

```ts
// v4 requires two arguments.
z.record(z.string(), z.number());

// Enum keys are exhaustive in v4.
z.record(z.enum(["a", "b"]), z.number());  // { a: number; b: number }

// For optional keys, use partialRecord.
z.partialRecord(z.enum(["a", "b"]), z.number());
```

### Recursive Types

```ts
const Category = z.object({
  name: z.string(),
  get subcategories() { return z.array(Category) },
});

type Category = z.infer<typeof Category>;
```

### Literals, Nullables, Optionals

```ts
z.literal("active");
z.literal([200, 201, 204]);  // multiple values

z.string().optional();   // string | undefined
z.string().nullable();   // string | null
z.string().nullish();    // string | null | undefined
```

### Files

```ts
z.file().min(10_000).max(1_000_000).mime(["image/png", "image/jpeg"]);
```

### Template Literals

```ts
const CssValue = z.templateLiteral([z.number(), z.enum(["px", "em", "rem"])]);
// `${number}px` | `${number}em` | `${number}rem`
```

## Parsing & Validation

### parse vs safeParse

```ts
// Throws ZodError on failure.
const user = UserSchema.parse(input);

// Returns { success, data, error } — never throws.
const result = UserSchema.safeParse(input);
if (result.success) {
  result.data; // typed
} else {
  result.error; // ZodError
}
```

Async versions: `parseAsync()`, `safeParseAsync()`.

## Error Handling

### Unified `error` parameter (v4)

```ts
// Simple string error.
z.string().min(5, { error: "Too short." });

// Dynamic error function.
z.string({
  error: (issue) =>
    issue.input === undefined ? "Required" : "Expected a string",
});

// Conditional by issue code.
z.number().min(0, {
  error: (issue) => {
    if (issue.code === "too_small") {
      return `Must be >= ${issue.minimum}`;
    }
  },
});
```

### Pretty-printing errors

```ts
const result = UserSchema.safeParse(badInput);
if (!result.success) {
  console.log(z.prettifyError(result.error));
}
```

### Tree-structured errors

```ts
const tree = z.treeifyError(result.error);
// Access nested errors via tree.properties.<fieldName>.errors
```

## Coercion

Coerces input before validation. Input type is `unknown`.

```ts
z.coerce.string();   // String(input)
z.coerce.number();   // Number(input)
z.coerce.boolean();  // Boolean(input) — falsy → false, truthy → true
z.coerce.date();     // new Date(input)
```

Environment-style boolean coercion:

```ts
z.stringbool();
// "true", "1", "yes", "on" → true
// "false", "0", "no", "off" → false
```

## Transforms & Pipes

```ts
// Transform changes the output type.
const schema = z.string().transform((val) => val.length);
// input: string → output: number

// Overwrite keeps the same type (allows chaining).
z.number().overwrite((val) => val ** 2).max(100);
```

Preprocess with pipes:

```ts
z.preprocess((val) => String(val), z.string().min(1));
```

## Defaults

```ts
// Default applies to the OUTPUT type (short-circuits parsing).
z.string().default("N/A");

// Prefault applies to the INPUT type (runs through parsing).
z.string().transform((v) => v.length).prefault("hello");
```

## Metadata & Registries

```ts
// Add metadata via the global registry.
z.string().meta({
  id: "user_email",
  title: "Email Address",
  description: "User's primary email",
  examples: ["user@example.com"],
});

// Custom typed registries.
const myRegistry = z.registry<{ label: string; searchable: boolean }>();
myRegistry.add(nameSchema, { label: "Full Name", searchable: true });
```

## JSON Schema Conversion

```ts
const jsonSchema = z.toJSONSchema(UserSchema);
// {
//   type: "object",
//   properties: { name: { type: "string" }, ... },
//   required: ["name", "email", "age"]
// }
```

Metadata from `z.globalRegistry` is automatically included.

## Common Patterns

### API response validation

```ts
const ApiResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("success"),
    data: z.unknown(),
  }),
  z.object({
    status: z.literal("error"),
    code: z.number(),
    message: z.string(),
  }),
]);
```

### Environment variables

```ts
const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.url(),
  DEBUG: z.stringbool().default(false),
  NODE_ENV: z.enum(["development", "production", "test"]),
});

const env = EnvSchema.parse(process.env);
```

### Form data validation

```ts
const FormSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.email(),
  password: z.string().min(8),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  error: "Passwords must match",
  path: ["confirmPassword"],
});
```

## Critical v4 Differences — Avoid v3 Patterns

| v3 (deprecated)                        | v4 (correct)                              |
|-----------------------------------------|-------------------------------------------|
| `z.string().email()`                    | `z.email()`                               |
| `z.string().url()`                      | `z.url()`                                 |
| `z.string().uuid()`                     | `z.uuidv4()`                              |
| `{ message: "..." }`                    | `{ error: "..." }`                        |
| `{ invalid_type_error, required_error}` | `{ error: (issue) => ... }`               |
| `z.nativeEnum(MyEnum)`                  | `z.enum(MyEnum)`                          |
| `z.record(z.string())`                  | `z.record(z.string(), z.string())`        |
| `.merge(OtherSchema)`                   | `.extend(OtherSchema.shape)`              |
| `.strict()` / `.passthrough()`          | `z.strictObject()` / `z.looseObject()`    |
| `z.string().ip()`                       | `z.ipv4()` / `z.ipv6()`                  |

## Additional Resources

- For detailed API patterns and advanced usage, see [reference.md](reference.md).
