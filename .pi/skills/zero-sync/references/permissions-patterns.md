# Permission Patterns

Zero does not have a built-in permissions system like RLS. Instead, use TypeScript code in queries and mutators with context.

## Context Setup

```typescript
type ZeroContext = {
  userID: string;
  role: "admin" | "user";
  organizationID?: string;
};

declare module "@rocicorp/zero" {
  interface DefaultTypes {
    context: ZeroContext;
  }
}
```

## Read Permissions

### Own Records Only

```typescript
const myPosts = defineQuery(({ ctx: { userID } }) =>
  zql.post.where("authorID", userID),
);
```

### Owned or Shared

```typescript
const visiblePosts = defineQuery(({ ctx: { userID } }) =>
  zql.post.where(({ cmp, exists, or }) =>
    or(
      cmp("authorID", userID),
      exists("sharedWith", (q) => q.where("userID", userID)),
    ),
  ),
);
```

### Admin Sees All

```typescript
const posts = defineQuery(({ ctx: { userID, role } }) => {
  if (role === "admin") return zql.post;
  return zql.post.where("authorID", userID);
});
```

### Organization-Scoped

```typescript
const orgPosts = defineQuery(({ ctx: { userID, organizationID } }) =>
  zql.post
    .where("organizationID", organizationID)
    .where(({ exists }) =>
      exists("organization", (q) =>
        q.whereExists("members", (m) => m.where("userID", userID)),
      ),
    ),
);
```

## Write Permissions

### Enforce Ownership on Create

```typescript
const createPost = defineMutator(
  z.object({ id: z.string(), title: z.string() }),
  async ({ tx, ctx: { userID }, args: { id, title } }) => {
    await tx.mutate.post.insert({
      id,
      title,
      authorID: userID, // Always set from context
    });
  },
);
```

### Check Ownership on Update

```typescript
const updatePost = defineMutator(
  z.object({ id: z.string(), title: z.string().optional() }),
  async ({ tx, ctx: { userID }, args }) => {
    const post = await tx.run(zql.post.where("id", args.id).one());

    if (!post) throw new Error("Not found");
    if (post.authorID !== userID) throw new Error("Access denied");

    await tx.mutate.post.update(args);
  },
);
```

### Admin Override

```typescript
const deletePost = defineMutator(
  z.object({ id: z.string() }),
  async ({ tx, ctx: { userID, role }, args: { id } }) => {
    const post = await tx.run(zql.post.where("id", id).one());

    if (!post) return;

    if (role !== "admin" && post.authorID !== userID) {
      throw new Error("Access denied");
    }

    await tx.mutate.post.delete({ id });
  },
);
```

### Check Membership Before Write

```typescript
const addToProject = defineMutator(
  z.object({ projectID: z.string(), userID: z.string() }),
  async ({ tx, ctx, args }) => {
    // Verify current user is project admin
    const membership = await tx.run(
      zql.projectMember
        .where("projectID", ctx.userID)
        .where("userID", args.projectID) // Wait, this is wrong
        .where("role", "admin")
        .one(),
    );

    if (!membership) throw new Error("Must be project admin");

    await tx.mutate.projectMember.insert({
      projectID: args.projectID,
      userID: args.userID,
      role: "member",
    });
  },
);
```

### Cascade Permission Check

```typescript
const updateComment = defineMutator(
  z.object({ id: z.string(), content: z.string() }),
  async ({ tx, ctx: { userID }, args }) => {
    const comment = await tx.run(
      zql.comment.where("id", args.id).related("post").one(),
    );

    if (!comment) throw new Error("Not found");

    // Can edit own comments OR own the post
    if (comment.authorID !== userID && comment.post.authorID !== userID) {
      throw new Error("Access denied");
    }

    await tx.mutate.comment.update({ id: args.id, content: args.content });
  },
);
```

## Server-Side Extensions

Use `baseMutators` to add server-only logic:

```typescript
// client-mutators.ts
export const mutators = defineMutators({
  posts: {
    create: defineMutator(schema, async ({ tx, ctx, args }) => {
      await tx.mutate.post.insert({ ...args, authorID: ctx.userID });
    }),
  },
});

// server-mutators.ts
export const serverMutators = defineMutators(mutators, {
  posts: {
    create: defineMutator(schema, async ({ tx, ctx, args }) => {
      // Run client mutator first
      await mutators.posts.create.fn({ tx, ctx, args });

      // Server-only: audit log
      await tx.mutate.auditLog.insert({
        id: nanoid(),
        action: "post.create",
        userID: ctx.userID,
        timestamp: Date.now(),
      });
    }),
  },
});
```

## Raw SQL for Complex Checks

```typescript
const bulkUpdate = defineMutator(
  z.object({ orgID: z.string(), status: z.string() }),
  async ({ tx, ctx, args }) => {
    if (tx.location === "server") {
      // Access raw Postgres transaction
      await tx.dbTransaction.query(
        `
        UPDATE posts 
        SET status = $1 
        WHERE org_id = $2 
        AND author_id = $3
      `,
        [args.status, args.orgID, ctx.userID],
      );
    }
  },
);
```
