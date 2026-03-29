# Drizzle ORM Reference — PostgreSQL

## Filter Operators

Import from `drizzle-orm`:

```typescript
import {
  eq, ne, gt, gte, lt, lte,
  like, ilike, notLike, notIlike,
  inArray, notInArray,
  isNull, isNotNull,
  between, notBetween,
  and, or, not,
  exists, notExists,
  arrayContains, arrayContained, arrayOverlaps,
  sql,
} from 'drizzle-orm';
```

### Usage in Query Builder

```typescript
// Equality.
db.select().from(users).where(eq(users.id, 1));

// Not equal.
db.select().from(users).where(ne(users.role, 'admin'));

// Comparison.
db.select().from(users).where(gt(users.age, 18));
db.select().from(users).where(gte(users.age, 18));
db.select().from(users).where(lt(users.age, 65));
db.select().from(users).where(lte(users.age, 65));

// Pattern matching.
db.select().from(users).where(like(users.name, 'A%'));
db.select().from(users).where(ilike(users.name, '%alice%'));

// IN / NOT IN.
db.select().from(users).where(inArray(users.role, ['admin', 'moderator']));
db.select().from(users).where(notInArray(users.id, [1, 2, 3]));

// NULL checks.
db.select().from(users).where(isNull(users.deletedAt));
db.select().from(users).where(isNotNull(users.email));

// BETWEEN.
db.select().from(users).where(between(users.age, 18, 65));

// Combining conditions.
db.select().from(users).where(
  and(
    eq(users.role, 'user'),
    or(
      like(users.name, 'A%'),
      like(users.name, 'B%'),
    ),
  ),
);

// NOT.
db.select().from(users).where(not(eq(users.role, 'admin')));

// Array operators (PostgreSQL).
db.select().from(users).where(arrayContains(users.tags, ['typescript']));
db.select().from(users).where(arrayOverlaps(users.tags, ['react', 'vue']));
```

### Usage in Relational Queries (v2 Object Syntax)

```typescript
// Simple equality (implicit).
db.query.users.findMany({ where: { id: 1 } });

// Operators.
db.query.users.findMany({ where: { age: { gt: 18 } } });

// OR.
db.query.users.findMany({
  where: {
    OR: [{ role: 'admin' }, { role: 'moderator' }],
  },
});

// AND (implicit — multiple keys).
db.query.users.findMany({
  where: { role: 'user', isActive: true },
});

// NOT.
db.query.users.findMany({
  where: { NOT: { role: 'admin' } },
});

// Raw SQL in relational queries.
db.query.users.findMany({
  where: {
    RAW: (table) => sql`${table.age} BETWEEN 18 AND 65`,
  },
});

// Filter by relations (users with at least one published post).
db.query.users.findMany({
  where: {
    posts: { published: true },
  },
});
```

### Complete Relational Query Filter Operators

```typescript
where: {
  [column]: value,                    // eq shorthand
  [column]: {
    eq: value,
    ne: value,
    gt: value,
    gte: value,
    lt: value,
    lte: value,
    in: [value],
    notIn: [value],
    like: string,
    ilike: string,
    notLike: string,
    notIlike: string,
    isNull: true,
    isNotNull: true,
    arrayContains: [value],
    arrayContained: [value],
    arrayOverlaps: [value],
    OR: [...],
    AND: [...],
    NOT: {...},
  },
  OR: [...],
  AND: [...],
  NOT: {...},
  RAW: (table) => sql`...`,
  [relation]: { /* filter by relation columns */ },
}
```

## PostgreSQL Column Types — Full List

### Numeric

```typescript
import {
  smallint, integer, bigint, serial, smallserial, bigserial,
  real, doublePrecision, numeric,
} from 'drizzle-orm/pg-core';

// integer types
smallint('col')             // 2-byte signed integer
integer('col')              // 4-byte signed integer
bigint('col', { mode: 'number' })  // 8-byte, mode: 'number' | 'bigint'

// Auto-increment
serial('col')               // 4-byte auto-increment
smallserial('col')          // 2-byte auto-increment
bigserial('col', { mode: 'number' }) // 8-byte auto-increment

// Floating point
real('col')                 // 4-byte float
doublePrecision('col')      // 8-byte float
numeric('col', { precision: 10, scale: 2 })  // Exact decimal
```

### String

```typescript
import { text, varchar, char, citext } from 'drizzle-orm/pg-core';

text('col')                       // Unlimited length
varchar('col', { length: 255 })   // Variable length with limit
char('col', { length: 10 })       // Fixed length
```

### Date & Time

```typescript
import { timestamp, date, time, interval } from 'drizzle-orm/pg-core';

timestamp('col')                           // Without timezone
timestamp('col', { withTimezone: true })   // With timezone (timestamptz)
timestamp('col', { mode: 'string' })       // Returns ISO string instead of Date
date('col')                                // Date only
date('col', { mode: 'date' })              // Returns JS Date
time('col')                                // Time only
time('col', { withTimezone: true })        // Time with timezone
interval('col')                            // Interval
```

### Boolean, UUID, JSON

```typescript
import { boolean, uuid, json, jsonb } from 'drizzle-orm/pg-core';

boolean('col')
uuid('col').defaultRandom()    // Auto-generate UUID v4
json('col')                    // Stored as text
jsonb('col')                   // Binary JSON (preferred for queries)
```

### Arrays

```typescript
import { text, integer } from 'drizzle-orm/pg-core';

text('tags').array()            // text[]
integer('scores').array()       // integer[]
text('matrix').array().array()  // text[][]
```

### Enums

```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

export const statusEnum = pgEnum('status', ['active', 'inactive', 'pending']);

// Use in table:
status: statusEnum('status').default('active').notNull(),
```

## Indexes & Constraints

### Indexes

```typescript
import { pgTable, text, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: integer('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
}, (table) => [
  // Basic index.
  index('users_email_idx').on(table.email),

  // Unique index.
  uniqueIndex('users_email_unique_idx').on(table.email),

  // Composite index.
  index('users_name_email_idx').on(table.name, table.email),

  // Partial index with WHERE.
  index('active_users_idx').on(table.email).where(sql`is_active = true`),

  // Expression index.
  index('users_lower_email_idx').on(sql`lower(${table.email})`),

  // GIN index (for jsonb/array columns).
  index('users_metadata_idx').using('gin', table.metadata),
]);
```

### Composite Primary Key

```typescript
import { pgTable, integer, primaryKey } from 'drizzle-orm/pg-core';

export const usersToGroups = pgTable('users_to_groups', {
  userId: integer('user_id').notNull().references(() => users.id),
  groupId: integer('group_id').notNull().references(() => groups.id),
}, (table) => [
  primaryKey({ columns: [table.userId, table.groupId] }),
]);
```

### Check Constraint

```typescript
import { pgTable, integer, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
}, (table) => [
  check('price_positive', sql`${table.price} > 0`),
]);
```

### Foreign Key with Actions

```typescript
// Inline reference.
authorId: integer('author_id').references(() => users.id, {
  onDelete: 'cascade',
  onUpdate: 'cascade',
}),

// Standalone foreign key.
import { foreignKey } from 'drizzle-orm/pg-core';

(table) => [
  foreignKey({
    name: 'author_fk',
    columns: [table.authorId],
    foreignColumns: [users.id],
  }).onDelete('cascade').onUpdate('cascade'),
]
```

Foreign key actions: `cascade`, `restrict`, `no action`, `set null`, `set default`.

## SQL Template Literal

The `sql` tagged template provides raw SQL escape hatch:

```typescript
import { sql } from 'drizzle-orm';

// Raw expression in select.
db.select({
  fullName: sql<string>`concat(${users.firstName}, ' ', ${users.lastName})`,
}).from(users);

// In WHERE.
db.select().from(users).where(sql`${users.age} > ${minAge}`);

// Raw execute.
await db.execute(sql`TRUNCATE TABLE ${users} CASCADE`);

// Type-safe count.
const [{ count }] = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(users);

// Using $count helper.
const userCount = await db.$count(users);
const activeCount = await db.$count(users, eq(users.isActive, true));
```

## Subqueries

```typescript
// Subquery in WHERE.
const subquery = db.select({ id: posts.authorId }).from(posts).where(eq(posts.published, true));

const authorsWithPublishedPosts = await db
  .select()
  .from(users)
  .where(inArray(users.id, subquery));

// Subquery as a derived table.
const sq = db
  .select({ authorId: posts.authorId, postCount: sql<number>`count(*)`.as('post_count') })
  .from(posts)
  .groupBy(posts.authorId)
  .as('post_counts');

const result = await db
  .select({ name: users.name, postCount: sq.postCount })
  .from(users)
  .innerJoin(sq, eq(users.id, sq.authorId));
```

## Set Operations

```typescript
import { union, unionAll, intersect, except } from 'drizzle-orm/pg-core';

// UNION.
const result = await union(
  db.select({ name: users.name }).from(users),
  db.select({ name: authors.name }).from(authors),
);

// UNION ALL.
const result = await unionAll(
  db.select().from(activeUsers),
  db.select().from(inactiveUsers),
);
```

## Aggregations

```typescript
import { sql } from 'drizzle-orm';
import { count, sum, avg, min, max } from 'drizzle-orm';

// Group by with aggregations.
const result = await db
  .select({
    role: users.role,
    total: count(),
    avgAge: avg(users.age),
  })
  .from(users)
  .groupBy(users.role)
  .having(sql`count(*) > 5`);
```

## Dynamic Query Building

Build queries conditionally:

```typescript
function getUsers(filters: { role?: string; minAge?: number; search?: string }) {
  let query = db.select().from(users).$dynamic();

  if (filters.role) {
    query = query.where(eq(users.role, filters.role));
  }
  if (filters.minAge) {
    query = query.where(gt(users.age, filters.minAge));
  }
  if (filters.search) {
    query = query.where(ilike(users.name, `%${filters.search}%`));
  }

  return query;
}
```

## Views

```typescript
import { pgView } from 'drizzle-orm/pg-core';

// Inline view.
export const activeUsers = pgView('active_users').as((qb) =>
  qb.select().from(users).where(eq(users.isActive, true))
);

// Query the view like a table.
const result = await db.select().from(activeUsers);
```

## Database Schemas (PostgreSQL)

```typescript
import { pgSchema } from 'drizzle-orm/pg-core';

const mySchema = pgSchema('my_schema');

export const myTable = mySchema.table('my_table', {
  id: serial('id').primaryKey(),
  name: text('name'),
});
```

## Batch API (Neon HTTP)

When using the Neon HTTP adapter, batch multiple queries in a single roundtrip:

```typescript
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql });

const results = await db.batch([
  db.select().from(users),
  db.insert(posts).values({ title: 'New', content: '...', authorId: 1 }),
  db.select().from(posts).where(eq(posts.published, true)),
]);
// results[0] = users, results[1] = insert result, results[2] = published posts
```

## Custom Types

Define reusable custom column types:

```typescript
import { customType } from 'drizzle-orm/pg-core';

// Example: a custom type that stores/retrieves as a specific format.
const citext = customType<{ data: string }>({
  dataType() {
    return 'citext';
  },
});

// Use in table.
export const users = pgTable('users', {
  email: citext('email').notNull(),
});
```

## Seeding (drizzle-seed)

Generate realistic test data:

```typescript
import { seed } from 'drizzle-seed';
import { db } from './db';
import * as schema from './schema';

await seed(db, schema);
// Or with specific count:
await seed(db, schema, { count: 100 });
```

## Old Relations API (pre-v1.0)

For projects still using `drizzle-orm` stable (pre-v1.0 beta), relations use the `relations()` function:

```typescript
import { relations } from 'drizzle-orm';

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));
```

Pass all tables and relations via a `schema` object:

```typescript
import * as schema from './schema';
const db = drizzle(client, { schema });
```

Relational query filters use callback syntax:

```typescript
const result = await db.query.users.findMany({
  where: (users, { eq }) => eq(users.role, 'admin'),
  orderBy: (users, { desc }) => desc(users.createdAt),
});
```
