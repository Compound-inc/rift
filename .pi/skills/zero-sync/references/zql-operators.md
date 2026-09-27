# ZQL Operators Reference

## Comparison Operators

| Operator             | Types                   | Description              |
| -------------------- | ----------------------- | ------------------------ |
| `=`, `!=`            | boolean, number, string | JS strict equality       |
| `<`, `<=`, `>`, `>=` | number                  | Numeric comparison       |
| `LIKE`, `NOT LIKE`   | string                  | Case-sensitive pattern   |
| `ILIKE`, `NOT ILIKE` | string                  | Case-insensitive pattern |
| `IN`, `NOT IN`       | boolean, number, string | Array membership         |
| `IS`, `IS NOT`       | any including null      | Null-safe comparison     |

## Pattern Matching

```typescript
// LIKE patterns
zql.post.where("title", "LIKE", "%zero%"); // Contains
zql.post.where("title", "LIKE", "zero%"); // Starts with
zql.post.where("title", "LIKE", "%zero"); // Ends with

// ILIKE for case-insensitive
zql.post.where("title", "ILIKE", "%ZERO%");

// NOT LIKE
zql.post.where("status", "NOT LIKE", "draft%");
```

## Array Membership

```typescript
// IN
zql.post.where("status", "IN", ["published", "draft"]);
zql.post.where("authorID", "IN", ["user-1", "user-2"]);

// NOT IN
zql.post.where("status", "NOT IN", ["archived", "deleted"]);
```

## Compound Expressions

### AND

```typescript
// Chained where() = AND
zql.post.where("status", "published").where("views", ">", 100);

// Explicit and()
zql.post.where(({ cmp, and }) =>
  and(cmp("status", "published"), cmp("views", ">", 100)),
);
```

### OR

```typescript
zql.post.where(({ cmp, or }) =>
  or(cmp("status", "featured"), cmp("views", ">", 1000)),
);
```

### NOT

```typescript
zql.post.where(({ cmp, not }) => not(cmp("status", "deleted")));
```

### Complex Combinations

```typescript
zql.post.where(({ cmp, and, or, not }) =>
  and(
    or(cmp("priority", "critical"), cmp("priority", "high")),
    not(cmp("status", "closed")),
    cmp("assigneeID", "IS NOT", null),
  ),
);
```

## Relationship Filters

### whereExists

```typescript
// Has any comments
zql.post.whereExists("comments");

// Has comments matching criteria
zql.post.whereExists("comments", (q) => q.where("authorID", userID));

// Nested relationship filter
zql.post.whereExists("comments", (q) => q.whereExists("replies"));
```

### exists Helper

```typescript
zql.post.where(({ cmp, or, exists }) =>
  or(
    cmp("authorID", userID),
    exists("comments", (q) => q.where("authorID", userID)),
  ),
);
```

## Ordering

```typescript
// Single sort
zql.post.orderBy("created", "desc");

// Multiple sorts (priority desc, then created desc)
zql.post.orderBy("priority", "desc").orderBy("created", "desc");

// Default: primary key ascending
zql.post; // Implicitly .orderBy('id', 'asc')
```

## Pagination

### Limit

```typescript
zql.post.limit(50);
```

### Cursor-Based (start)

```typescript
// Exclusive start (default) - starts AFTER row
zql.post.orderBy("created", "desc").start(lastRow);

// Inclusive start - includes row
zql.post.orderBy("created", "desc").start(lastRow, { inclusive: true });

// Pagination loop
let start: PostRow | undefined;
while (true) {
  let q = zql.post.orderBy("created", "desc").limit(100);
  if (start) q = q.start(start);

  const batch = await q.run();
  processBatch(batch);

  if (batch.length < 100) break;
  start = batch[batch.length - 1];
}
```

## Relationships

### Basic

```typescript
zql.post.related("author");
zql.post.related("comments");
zql.post.related("author").related("comments");
```

### Refined

```typescript
zql.post.related("comments", (q) =>
  q.orderBy("created", "desc").limit(10).where("spam", false),
);
```

### Nested

```typescript
zql.post.related("comments", (q) =>
  q
    .orderBy("created", "desc")
    .limit(10)
    .related("author")
    .related("replies", (r) => r.limit(5)),
);
```

## Type Extraction

```typescript
import type { QueryResultType, QueryRowType } from "@rocicorp/zero";

const query = zql.post.related("comments", (q) => q.related("author"));

// Full result type (array)
type Result = QueryResultType<typeof query>;

// Single row type
type Row = QueryRowType<typeof query>;
```

## Join Flipping

For performance, manually flip joins when it's more efficient:

```typescript
// Documents where user 42 is an editor
// flip: true is faster if user has few documents
zql.document.whereExists("editors", (e) => e.where("userID", 42), {
  flip: true,
});
```
