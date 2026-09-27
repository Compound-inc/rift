---
name: zero-sync
description: Zero sync engine patterns for React and TanStack Start apps. Schema definition, queries, mutators, authentication, and real-time sync. Use when implementing Zero (@rocicorp/zero), defining ZQL queries, creating mutators, or setting up sync with Postgres.
---

# Zero Sync Engine

Zero is a query-driven sync engine that replicates Postgres into a SQLite replica inside `zero-cache`, then syncs subsets of rows to clients based on queries. Client reads/writes hit local storage first (instant UI), with `zero-cache` keeping clients up to date via logical replication.

## Quick Reference: Critical Rules

| Category      | DO                                          | DON'T                                  |
| ------------- | ------------------------------------------- | -------------------------------------- |
| IDs           | Client-generated (`nanoid`, `uuidv7`)       | Auto-increment IDs                     |
| ID Generation | Generate IDs outside mutators, pass as args | Generate IDs inside mutators           |
| Query Results | Treat as immutable, don't mutate            | Modify returned objects directly       |
| Mutators      | Always `await` writes                       | Let writes float un-awaited            |
| Auth          | Pass `context` with userID for permissions  | Trust `args` for auth decisions        |
| Queries       | Use `defineQuery` with validators           | Skip validation for query args         |
| 404 UI        | Only show when `result.type === 'complete'` | Show 404 on empty local data           |
| Preloading    | Preload common query shapes/sorts           | Rely on single preload for all queries |
| TTL           | Use default (5m) or `none` for preload      | Set TTL > 10m                          |

## Schema Definition

### Table Schemas

```typescript
import {
  table,
  string,
  boolean,
  number,
  json,
  enumeration,
  createSchema,
} from "@rocicorp/zero";

const user = table("user")
  .columns({
    id: string(),
    name: string(),
    role: enumeration<"admin" | "user">(),
    settings: json<{ theme: "light" | "dark" }>().optional(),
  })
  .primaryKey("id");

const post = table("post")
  .from("posts") // Map TS name to DB name
  .columns({
    id: string(),
    title: string(),
    authorID: string().from("author_id"), // Column name mapping
    content: string().optional(),
    published: boolean(),
  })
  .primaryKey("id");
```

### Relationships

```typescript
import { relationships } from "@rocicorp/zero";

const postRelationships = relationships(post, ({ one, many }) => ({
  author: one({
    sourceField: ["authorID"],
    destField: ["id"],
    destSchema: user,
  }),
  comments: many({
    sourceField: ["id"],
    destSchema: comment,
    destField: ["postID"],
  }),
}));

// Many-to-many through junction table
const issueRelationships = relationships(issue, ({ many }) => ({
  labels: many(
    { sourceField: ["id"], destSchema: issueLabel, destField: ["issueID"] },
    { sourceField: ["labelID"], destSchema: label, destField: ["id"] },
  ),
}));
```

### Schema Export

```typescript
export const schema = createSchema({
  tables: [user, post, comment],
  relationships: [postRelationships, commentRelationships],
});

// Register types globally
declare module "@rocicorp/zero" {
  interface DefaultTypes {
    schema: typeof schema;
  }
}
```

## Queries

### Defining Queries

```typescript
import { defineQueries, defineQuery } from "@rocicorp/zero";
import { z } from "zod";
import { zql } from "./schema";

export const queries = defineQueries({
  posts: {
    all: defineQuery(() => zql.post),

    byAuthor: defineQuery(
      z.object({ authorID: z.string() }),
      ({ args: { authorID } }) => zql.post.where("authorID", authorID),
    ),

    byStatus: defineQuery(
      z.object({ status: z.string(), limit: z.number().optional() }),
      ({ args: { status, limit } }) => {
        let q = zql.post.where("published", status === "published");
        if (limit) q = q.limit(limit);
        return q.orderBy("created", "desc");
      },
    ),
  },
});
```

### Context for Permissions

```typescript
type ZeroContext = { userID: string; role: "admin" | "user" };

declare module "@rocicorp/zero" {
  interface DefaultTypes {
    context: ZeroContext;
  }
}

// Use context in queries
const myPosts = defineQuery(({ ctx: { userID } }) =>
  zql.post.where("authorID", userID),
);

const visiblePosts = defineQuery(({ ctx: { userID, role } }) => {
  if (role === "admin") return zql.post;
  return zql.post.where("authorID", userID);
});
```

### React Integration

```typescript
import { useQuery, useZero, ZeroProvider } from '@rocicorp/zero/react'

// Setup
function Root() {
  const session = useSession()
  return (
    <ZeroProvider
      userID={session.userID}
      context={{ userID: session.userID, role: session.role }}
      cacheURL={import.meta.env.VITE_ZERO_CACHE_URL}
      schema={schema}
      mutators={mutators}
    >
      <App />
    </ZeroProvider>
  )
}

// Usage
function PostList() {
  const [posts, result] = useQuery(queries.posts.byStatus({ status: 'published' }))

  // Handle 404 correctly
  if (result.type === 'unknown' && posts.length === 0) {
    return <div>Loading...</div>
  }
  if (result.type === 'complete' && posts.length === 0) {
    return <div>No posts found</div>
  }

  return posts.map(p => <Post key={p.id} post={p} />)
}

// Mutations
function CreatePost() {
  const zero = useZero()

  const handleCreate = () => {
    zero.mutate(mutators.posts.create({
      id: nanoid(),
      title: 'New Post'
    }))
  }

  return <button onClick={handleCreate}>Create</button>
}
```

### Suspense Support

```typescript
import { useSuspenseQuery } from '@rocicorp/zero/react'

function PostList() {
  const [posts] = useSuspenseQuery(queries.posts.all(), {
    suspendUntil: 'complete' // or 'partial'
  })
  return posts.map(p => <Post key={p.id} post={p} />)
}
```

## Mutators

### Defining Mutators

```typescript
import { defineMutators, defineMutator } from "@rocicorp/zero";
import { z } from "zod";
import { nanoid } from "nanoid";

export const mutators = defineMutators({
  posts: {
    create: defineMutator(
      z.object({ id: z.string(), title: z.string() }),
      async ({ tx, ctx: { userID }, args: { id, title } }) => {
        await tx.mutate.post.insert({
          id,
          title,
          authorID: userID,
          published: false,
        });
      },
    ),

    update: defineMutator(
      z.object({ id: z.string(), title: z.string().optional() }),
      async ({ tx, ctx: { userID }, args: { id, title } }) => {
        const post = await tx.run(zql.post.where("id", id).one());
        if (!post) return;
        if (post.authorID !== userID) throw new Error("Access denied");

        await tx.mutate.post.update({ id, title });
      },
    ),

    delete: defineMutator(
      z.object({ id: z.string() }),
      async ({ tx, args: { id } }) => {
        await tx.mutate.post.delete({ id });
      },
    ),
  },
});
```

### CRUD Operations

```typescript
// Insert
await tx.mutate.user.insert({
  id: nanoid(),
  name: "Sam",
  language: null, // Explicit null
});

await tx.mutate.user.insert({
  id: nanoid(),
  name: "Sam",
  // language gets DB default
});

// Upsert
await tx.mutate.user.upsert({ id, name: "Updated" });

// Update (partial)
await tx.mutate.user.update({ id, language: "ts" }); // name unchanged

// Delete
await tx.mutate.user.delete({ id });
```

### Reading in Mutators

```typescript
const updateIfAllowed = defineMutator(
  z.object({ id: z.string(), status: z.string() }),
  async ({ tx, ctx: { userID }, args: { id, status } }) => {
    // Read with ZQL
    const post = await tx.run(zql.post.where("id", id).related("author").one());

    if (!post || post.author.id !== userID) {
      throw new Error("Access denied");
    }

    await tx.mutate.post.update({ id, status });
  },
);
```

### Waiting for Results

```typescript
const write = zero.mutate(
  mutators.posts.create({ id: nanoid(), title: "New" }),
);

// Wait for client write (< 1 frame usually)
await write.client;

// Wait for server write
const serverRes = await write.server;
if (serverRes.type === "error") {
  console.error("Mutation failed", serverRes.error);
}
```

## ZQL Reference

### Basic Queries

```typescript
// All rows
zql.post;

// Filter
zql.post.where("status", "published");
zql.post.where("views", ">", 100);
zql.post.where("title", "LIKE", "%zero%");

// Order and limit
zql.post.orderBy("created", "desc").limit(50);

// Single result
zql.post.where("id", id).one();
```

### Relationships

```typescript
// Include related data
zql.post.related("author").related("comments");

// Nested relationships
zql.post.related("comments", (q) =>
  q.orderBy("created", "desc").limit(10).related("author"),
);

// Filter by relationship existence
zql.post.whereExists("comments");
zql.post.whereExists("comments", (q) => q.where("authorID", userID));
```

### Compound Filters

```typescript
zql.post.where(({ cmp, and, or, not, exists }) =>
  or(
    cmp("priority", "critical"),
    and(cmp("status", "open"), not(cmp("votes", "<", 10))),
  ),
);
```

### Null Handling

```typescript
// WRONG - comparing null with = always returns false
zql.post.where("deletedAt", "!=", null); // Never matches!

// CORRECT - use IS / IS NOT
zql.post.where("deletedAt", "IS", null);
zql.post.where("deletedAt", "IS NOT", null);
```

## TanStack Start Integration

### Server Endpoints

```typescript
// routes/api/zero/query.ts
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { handleQueryRequest, mustGetQuery } from "@rocicorp/zero/server";
import { queries } from "~/zero/queries";
import { dbProvider } from "~/zero/db";

export const APIRoute = createAPIFileRoute("/api/zero/query")({
  POST: async ({ request }) => {
    return handleQueryRequest(async (name, args, ctx) => {
      const query = mustGetQuery(queries, name);
      return query.fn({ args, ctx });
    }, request);
  },
});

// routes/api/zero/mutate.ts
import { handleMutateRequest, mustGetMutator } from "@rocicorp/zero/server";
import { mutators } from "~/zero/mutators";

export const APIRoute = createAPIFileRoute("/api/zero/mutate")({
  POST: async ({ request }) => {
    return handleMutateRequest(
      dbProvider,
      async (tx, name, args, ctx) => {
        const mutator = mustGetMutator(mutators, name);
        return mutator.fn({ tx, args, ctx });
      },
      request,
    );
  },
});
```

### Auth Middleware

```typescript
// Get session and build context
import { getSession } from "~/lib/auth";

export const APIRoute = createAPIFileRoute("/api/zero/$")({
  POST: async ({ request }) => {
    const session = await getSession(request);
    const ctx = {
      userID: session?.userId ?? "anon",
      role: session?.role ?? "user",
    };
    // ... use ctx in handlers
  },
});
```

## Authentication

### Cookie Auth (Recommended)

```bash
# .env
ZERO_QUERY_FORWARD_COOKIES=true
ZERO_MUTATE_FORWARD_COOKIES=true
```

Cookies from frontend are forwarded to query/mutate endpoints automatically. Set cookies with `Domain=.example.com` for cross-subdomain.

### Token Auth

```typescript
const zero = new Zero({
  auth: token, // Sent as Authorization: Bearer <token>
});
```

### Handling Auth Errors

```typescript
import { useConnectionState } from '@rocicorp/zero/react'

function AuthHandler() {
  const state = useConnectionState()

  if (state.name === 'needs-auth') {
    return (
      <button onClick={async () => {
        await refreshToken()
        zero.connection.connect()
      }}>
        Reconnect
      </button>
    )
  }
  return null
}
```

## Connection States

| State          | Reads | Writes       | Description               |
| -------------- | ----- | ------------ | ------------------------- |
| `connecting`   | Yes   | Yes (queued) | Initial or reconnecting   |
| `connected`    | Yes   | Yes          | Normal operation          |
| `disconnected` | Yes   | No           | Timeout while connecting  |
| `error`        | Yes   | No           | Server/mutate/query error |
| `needs-auth`   | Yes   | No           | 401/403 received          |
| `closed`       | No    | No           | After `zero.close()`      |

## Gotchas & Common Pitfalls

### ID Generation

```typescript
// WRONG - IDs generated inside mutator run multiple times
const badMutator = defineMutator(
  z.object({ title: z.string() }),
  async ({ tx, args }) => {
    await tx.mutate.post.insert({ id: nanoid(), title: args.title });
  },
);

// CORRECT - IDs passed as arguments
const goodMutator = defineMutator(
  z.object({ id: z.string(), title: z.string() }),
  async ({ tx, args: { id, title } }) => {
    await tx.mutate.post.insert({ id, title });
  },
);

// Usage
zero.mutate(mutators.posts.create({ id: nanoid(), title: "New" }));
```

### Mutator Re-execution

Mutators run multiple times (twice on client, once on server). Never:

- Generate IDs inside
- Perform side effects without idempotency checks
- Assume single execution

### Query Result Immutability

```typescript
// WRONG - mutating cached data
const [posts] = useQuery(queries.posts.all());
posts[0].title = "Changed"; // Corrupts cache!

// CORRECT - clone before modifying
const updated = { ...posts[0], title: "Changed" };
```

### Null Semantics

```typescript
// In ZQL (like SQL), null comparisons are always false
zql.post.where("authorID", "!=", null); // Never matches!

// Use IS / IS NOT
zql.post.where("authorID", "IS NOT", null);
```

### Optional vs Undefined

- **Reading**: Optional fields return `null` (never `undefined`)
- **Writing**:
  - `null` = explicitly set to null
  - `undefined` = use default value (insert) or leave unchanged (update)

### 404 Flicker

```typescript
// WRONG - shows 404 while loading
const [posts] = useQuery(query)
if (posts.length === 0) return <NotFound />

// CORRECT - only show 404 after complete
const [posts, result] = useQuery(query)
if (result.type !== 'complete') return <Loading />
if (posts.length === 0) return <NotFound />
```

## File Structure

```
src/
├── zero/
│   ├── schema.ts          # Table definitions, relationships
│   ├── queries.ts         # All query definitions
│   ├── mutators/
│   │   ├── index.ts       # defineMutators registry
│   │   ├── posts.ts       # Post mutators
│   │   └── users.ts       # User mutators
│   └── db.ts              # Server-side DB provider
├── routes/
│   └── api/zero/
│       ├── query.ts       # Query endpoint
│       └── mutate.ts      # Mutate endpoint
```

## Further Reading

- `references/zql-operators.md` - Complete ZQL operator reference
- `references/permissions-patterns.md` - Detailed permission patterns
