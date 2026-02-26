---
name: drizzle-orm
description: Comprehensive guide to Drizzle ORM for PostgreSQL. Covers schema definition, CRUD queries, relational queries, joins, filters, transactions, migrations, type inference, and drizzle-kit. Use when writing database schemas, queries, or migrations with Drizzle ORM, or when the user asks about Drizzle patterns, pgTable, drizzle-kit, or relational queries.
---

# Drizzle ORM for PostgreSQL

## Dependencies

```bash
bun add drizzle-orm
bun add -D drizzle-kit
```

For Neon-specific connection setup, see the [neon-drizzle skill](../neon-drizzle/SKILL.md).

## Schema Definition

Define tables using `pgTable` from `drizzle-orm/pg-core`.

```typescript
import {
  pgTable, pgEnum, serial, integer, text, boolean,
  timestamp, varchar, uuid, jsonb, numeric, index, uniqueIndex,
} from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ['admin', 'user', 'moderator']);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  role: roleEnum('role').default('user').notNull(),
  metadata: jsonb('metadata'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}, (table) => [
  index('users_email_idx').on(table.email),
]);

export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  published: boolean('published').default(false).notNull(),
  authorId: integer('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('posts_author_id_idx').on(table.authorId),
]);
```

### Common Column Types (PostgreSQL)

| Drizzle Type | PostgreSQL Type | Notes |
|---|---|---|
| `serial()` | `serial` | Auto-incrementing integer. |
| `integer()` | `integer` | 32-bit integer. |
| `bigint()` | `bigint` | 64-bit integer. Use `{ mode: 'number' }` for JS number. |
| `text()` | `text` | Unlimited length string. |
| `varchar()` | `varchar(n)` | Variable length with limit. |
| `boolean()` | `boolean` | True/false. |
| `timestamp()` | `timestamp` | Use `{ withTimezone: true }` for `timestamptz`. |
| `date()` | `date` | Date without time. Use `{ mode: 'date' }` for JS Date. |
| `uuid()` | `uuid` | Use `.defaultRandom()` for auto-generation. |
| `jsonb()` | `jsonb` | Binary JSON. Preferred over `json()`. |
| `numeric()` | `numeric` | Exact decimal. Use `{ precision, scale }`. |
| `real()` | `real` | Floating point. |
| `pgEnum()` | `enum` | Define enum type separately, then use in column. |

For the complete column types and constraint reference, see [reference.md](reference.md).

## Type Inference

Extract TypeScript types directly from your schema:

```typescript
// Select type: all columns, nullable columns are T | null.
export type User = typeof users.$inferSelect;

// Insert type: optional columns (with defaults) are T | undefined.
export type NewUser = typeof users.$inferInsert;
```

## Relations (v2 — `defineRelations`)

Use `defineRelations` from `drizzle-orm` to define relations for the relational queries API. Relations are application-level only and do not create foreign keys.

```typescript
import { defineRelations } from 'drizzle-orm';
import * as schema from './schema';

export const relations = defineRelations(schema, (r) => ({
  // One-to-many: a user has many posts.
  users: {
    posts: r.many.posts(),
  },
  // Many-to-one: a post belongs to one user.
  posts: {
    author: r.one.users({
      from: r.posts.authorId,
      to: r.users.id,
    }),
  },
}));
```

### One-to-One

```typescript
export const relations = defineRelations(schema, (r) => ({
  users: {
    profile: r.one.profiles({
      from: r.users.id,
      to: r.profiles.userId,
    }),
  },
}));
```

### Many-to-Many (with junction table)

Use `through` to bypass the junction table in query results:

```typescript
export const relations = defineRelations(schema, (r) => ({
  users: {
    groups: r.many.groups({
      from: r.users.id.through(r.usersToGroups.userId),
      to: r.groups.id.through(r.usersToGroups.groupId),
    }),
  },
  groups: {
    members: r.many.users(),
  },
}));
```

### Passing Relations to Drizzle

```typescript
import { relations } from './relations';
import { drizzle } from 'drizzle-orm/neon-http';

const db = drizzle({ client: sql, relations });
```

## Drizzle Config

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## CRUD Operations

### Select

```typescript
import { eq, and, gt, like, sql } from 'drizzle-orm';
import { db } from './db';
import { users, posts } from './schema';

// Select all columns.
const allUsers = await db.select().from(users);

// Select specific columns.
const names = await db.select({ id: users.id, name: users.name }).from(users);

// With WHERE clause.
const admins = await db.select().from(users).where(eq(users.role, 'admin'));

// Multiple conditions.
const result = await db.select().from(users).where(
  and(eq(users.role, 'user'), gt(users.createdAt, new Date('2025-01-01')))
);

// Order, limit, offset.
const paginated = await db
  .select()
  .from(users)
  .orderBy(users.createdAt)
  .limit(10)
  .offset(20);

// Count.
const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(users);
```

### Insert

```typescript
// Single insert with returning.
const [newUser] = await db.insert(users).values({
  name: 'Alice',
  email: 'alice@example.com',
}).returning();

// Batch insert.
await db.insert(users).values([
  { name: 'Bob', email: 'bob@example.com' },
  { name: 'Carol', email: 'carol@example.com' },
]);

// Upsert (on conflict).
await db.insert(users)
  .values({ name: 'Alice', email: 'alice@example.com' })
  .onConflictDoUpdate({
    target: users.email,
    set: { name: 'Alice Updated' },
  });

// Insert with do nothing on conflict.
await db.insert(users)
  .values({ name: 'Alice', email: 'alice@example.com' })
  .onConflictDoNothing({ target: users.email });
```

### Update

```typescript
const [updated] = await db
  .update(users)
  .set({ name: 'Alice Smith', role: 'admin' })
  .where(eq(users.id, 1))
  .returning();
```

### Delete

```typescript
const [deleted] = await db
  .delete(users)
  .where(eq(users.id, 1))
  .returning();
```

## Relational Queries

The relational query API provides a convenient way to fetch nested data without manual joins. Requires `relations` passed to `drizzle()`.

### findMany / findFirst

```typescript
// Fetch all users.
const allUsers = await db.query.users.findMany();

// Fetch single user.
const user = await db.query.users.findFirst();
```

### Include Relations (`with`)

```typescript
// Users with their posts.
const usersWithPosts = await db.query.users.findMany({
  with: { posts: true },
});

// Nested: posts with author and comments, comments with their author.
const postsWithDetails = await db.query.posts.findMany({
  with: {
    author: true,
    comments: {
      with: { author: true },
    },
  },
});
```

### Partial Field Selection (`columns`)

```typescript
const result = await db.query.users.findMany({
  columns: { id: true, name: true },
  with: {
    posts: { columns: { title: true } },
  },
});
```

### Filters (`where`)

```typescript
// Simple equality.
const result = await db.query.users.findMany({
  where: { id: 1 },
});

// Using operators.
const result = await db.query.users.findMany({
  where: {
    role: { eq: 'admin' },
    createdAt: { gt: new Date('2025-01-01') },
  },
});

// OR condition.
const result = await db.query.users.findMany({
  where: {
    OR: [
      { role: { eq: 'admin' } },
      { name: { like: 'A%' } },
    ],
  },
});

// NOT condition.
const result = await db.query.users.findMany({
  where: {
    NOT: { role: 'admin' },
  },
});
```

### Ordering, Limit, Offset

```typescript
const result = await db.query.posts.findMany({
  orderBy: { createdAt: 'desc' },
  limit: 10,
  offset: 20,
  with: {
    comments: {
      orderBy: { createdAt: 'asc' },
      limit: 5,
    },
  },
});
```

### Custom Extra Fields

```typescript
import { sql } from 'drizzle-orm';

const result = await db.query.users.findMany({
  extras: {
    nameLength: (table, { sql }) => sql<number>`length(${table.name})`,
  },
});
```

## Joins

```typescript
import { eq } from 'drizzle-orm';

// Inner join.
const result = await db
  .select({
    postTitle: posts.title,
    authorName: users.name,
  })
  .from(posts)
  .innerJoin(users, eq(posts.authorId, users.id));

// Left join.
const result = await db
  .select()
  .from(users)
  .leftJoin(posts, eq(users.id, posts.authorId));

// Multiple joins.
const result = await db
  .select({
    post: posts.title,
    author: users.name,
    comment: comments.text,
  })
  .from(posts)
  .innerJoin(users, eq(posts.authorId, users.id))
  .leftJoin(comments, eq(posts.id, comments.postId));
```

## Transactions

```typescript
const result = await db.transaction(async (tx) => {
  const [user] = await tx.insert(users).values({
    name: 'Alice',
    email: 'alice@example.com',
  }).returning();

  await tx.insert(posts).values({
    title: 'First Post',
    content: 'Hello!',
    authorId: user.id,
  });

  return user;
});
```

Nested transactions use savepoints:

```typescript
await db.transaction(async (tx) => {
  await tx.insert(users).values({ name: 'Alice', email: 'alice@example.com' });

  // Savepoint: rolls back only this block on failure.
  await tx.transaction(async (nested) => {
    await nested.insert(posts).values({ title: 'Draft', content: '...', authorId: 1 });
  });
});
```

## Prepared Statements

Improve performance for repeated queries:

```typescript
const getUserById = db
  .select()
  .from(users)
  .where(eq(users.id, sql.placeholder('id')))
  .prepare('get_user_by_id');

const user = await getUserById.execute({ id: 1 });

// Relational query with placeholder.
const prepared = db.query.users.findMany({
  where: { id: { eq: sql.placeholder('id') } },
  with: { posts: true },
}).prepare('user_with_posts');

const result = await prepared.execute({ id: 1 });
```

## Migrations

### drizzle-kit Commands

| Command | Description |
|---|---|
| `bunx drizzle-kit generate` | Generate SQL migration files from schema changes. |
| `bunx drizzle-kit migrate` | Apply pending migrations to the database. |
| `bunx drizzle-kit push` | Push schema directly to database (no migration files). Good for prototyping. |
| `bunx drizzle-kit pull` | Introspect an existing database and generate schema files. |
| `bunx drizzle-kit studio` | Launch Drizzle Studio GUI to browse data. |
| `bunx drizzle-kit check` | Check consistency of migration files. |

### Typical Migration Workflow

1. Edit your schema in `src/db/schema.ts`.
2. Generate migration: `bunx drizzle-kit generate`
3. Review the generated SQL in `./drizzle/`.
4. Apply migration: `bunx drizzle-kit migrate`

### Custom Migrations

For data migrations or complex operations not expressible in schema:

```typescript
// drizzle/custom-migration.ts
import { sql } from 'drizzle-orm';
import { db } from '../src/db';

await db.execute(sql`UPDATE users SET role = 'user' WHERE role IS NULL`);
```

## Zod Schema Validation

In v1.0 beta, validators are imported from `drizzle-orm/zod`. For stable versions, use `drizzle-zod` as a separate package.

```typescript
import { createInsertSchema, createSelectSchema } from 'drizzle-orm/zod';
import { users } from './schema';

const insertUserSchema = createInsertSchema(users);
const selectUserSchema = createSelectSchema(users);

// Override or refine fields.
const createUserSchema = createInsertSchema(users, {
  email: (schema) => schema.email(),
  name: (schema) => schema.min(2).max(100),
});
```

## Additional Resources

- For complete filter operators, column types, and advanced patterns, see [reference.md](reference.md).
- For Neon-specific connection and optimization, see [neon-drizzle skill](../neon-drizzle/SKILL.md).
- [Drizzle ORM documentation](https://orm.drizzle.team/docs/overview)
