# Zod v4 — Detailed API Reference

## Schema Composition

### Intersections

Combine two schemas — both must pass:

```ts
const NamedEntity = z.object({ name: z.string() });
const Timestamped = z.object({ createdAt: z.date() });

const NamedTimestamped = z.intersection(NamedEntity, Timestamped);
// or: NamedEntity.and(Timestamped)
```

Intersections throw a regular `Error` (not `ZodError`) on structural merge conflicts.

### Pipes

Chain schemas sequentially — output of the first feeds into the second:

```ts
const StringToNumber = z.pipe(
  z.string(),
  z.transform((s) => Number(s)),
  z.number().positive(),
);
```

### Branded Types

Prevent accidental type mixing:

```ts
const UserId = z.string().brand<"UserId">();
const PostId = z.string().brand<"PostId">();

type UserId = z.infer<typeof UserId>; // string & { __brand: "UserId" }
```

### Lazy Schemas

For forward references in recursive types:

```ts
const TreeNode = z.object({
  value: z.string(),
  children: z.lazy(() => z.array(TreeNode)),
});
```

Prefer the getter-based recursive pattern (`get children() { return ... }`) over `z.lazy()` when possible — it provides better type inference.

## Refinements & Checks

### Custom Refinements

```ts
z.string().refine(
  (val) => val.includes("@"),
  { error: "Must contain @" },
);
```

Refinements live inside schemas in v4 — chaining `.refine()` with other methods works:

```ts
z.string()
  .refine((val) => val.includes("@"))
  .min(5); // works in v4
```

### SuperRefine

For multi-issue refinements:

```ts
z.string().superRefine((val, ctx) => {
  if (val.length < 3) {
    ctx.addIssue({
      code: "too_small",
      minimum: 3,
      inclusive: true,
      origin: "string",
      message: "Too short",
    });
  }
  if (!val.includes("@")) {
    ctx.addIssue({
      code: "custom",
      message: "Must contain @",
    });
  }
});
```

Note: `ctx.path` is NOT available in v4 refinements.

## Error Handling In-Depth

### ZodError Structure

```ts
const result = schema.safeParse(input);
if (!result.success) {
  const err = result.error;

  // Access individual issues.
  for (const issue of err.issues) {
    console.log(issue.code);    // e.g. "invalid_type", "too_small"
    console.log(issue.path);    // e.g. ["user", "email"]
    console.log(issue.message); // human-readable message
  }
}
```

### Issue Codes (v4)

| Code                      | Description                               |
|---------------------------|-------------------------------------------|
| `invalid_type`            | Wrong type received                       |
| `too_big`                 | Exceeds maximum                           |
| `too_small`               | Below minimum                             |
| `invalid_string_format`   | Failed string format check                |
| `not_multiple_of`         | Not a multiple of the specified value     |
| `unrecognized_keys`       | Extra keys in strict objects              |
| `invalid_value`           | Invalid literal or enum value             |
| `invalid_union`           | No union member matched                   |
| `invalid_key`             | Invalid key in record/map                 |
| `invalid_element`         | Invalid element in map/set                |
| `custom`                  | Custom refinement failure                 |

### Pretty Errors

```ts
console.log(z.prettifyError(error));
// ✖ Invalid input: expected string, received number
//   → at username
// ✖ Too small: expected number to be >=0
//   → at favoriteNumbers[1]
```

### Tree Errors

```ts
const tree = z.treeifyError(error);
// tree.errors → top-level errors
// tree.properties.fieldName.errors → field errors
// tree.properties.nested.properties.deep.errors → nested errors
// tree.items[0].errors → array item errors
```

### Internationalization

```ts
import * as z from "zod";

// Set locale globally.
z.config(z.locales.en());
```

## Advanced Object Patterns

### Catchall

Accept unknown keys with a specific value type:

```ts
const Schema = z.object({
  name: z.string(),
}).catchall(z.number());
// { name: string; [key: string]: number }
```

### Key/Value Schemas

```ts
z.map(z.string(), z.number());
z.set(z.string());
```

## Coercion Details

All `z.coerce` schemas accept `unknown` input:

```ts
z.coerce.string();   // String(input)
z.coerce.number();   // Number(input)
z.coerce.boolean();  // Boolean(input)
z.coerce.bigint();   // BigInt(input)
z.coerce.date();     // new Date(input)
```

### Stringbool Customization

```ts
z.stringbool({
  truthy: ["yes", "true", "1"],
  falsy: ["no", "false", "0"],
});
```

## JSON Schema Details

### Basic Conversion

```ts
const schema = z.object({
  name: z.string().meta({ description: "Full name" }),
  age: z.int().meta({ examples: [25, 30] }),
});

z.toJSONSchema(schema);
```

### Metadata is Included Automatically

Any metadata registered in `z.globalRegistry` (via `.meta()` or `.describe()`) flows into the generated JSON Schema.

### Custom Registries for JSON Schema

```ts
const apiRegistry = z.registry<{
  title: string;
  deprecated?: boolean;
}>();

const nameField = z.string().register(apiRegistry, {
  title: "User Name",
  deprecated: false,
});
```

## Zod Functions (v4 API)

```ts
const greet = z.function({
  input: [z.object({ name: z.string() })],
  output: z.string(),
});

const greetImpl = greet.implement((input) => {
  return `Hello, ${input.name}!`;
});

// Async variant.
const fetchUser = z.function({
  input: [z.object({ id: z.string() })],
  output: z.object({ name: z.string(), email: z.email() }),
});

const fetchUserImpl = fetchUser.implementAsync(async (input) => {
  const res = await fetch(`/api/users/${input.id}`);
  return res.json();
});
```

## Type Utilities

```ts
// Infer output type.
type User = z.infer<typeof UserSchema>;

// Infer input type (before transforms).
type UserInput = z.input<typeof UserSchema>;

// Check if a value matches without throwing.
const isValid = schema.safeParse(value).success;
```
