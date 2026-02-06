---
name: effect
description: Effect-TS Best Practices for Next.js Apps
---
# Effect-TS Best Practices for Next.js Apps

This document outlines coding rules and best practices for using Effect-TS in a Next.js application. The focus is on achieving full type safety, optimistic UI updates, detailed error handling, proper async/sync management, observability, and overall maintainability. These guidelines promote a "type safety" mindset: avoid `any`, leverage inference, and ensure everything is composable and predictable.

## Code Structure and Organization
- Prefer generator syntax using `Effect.gen` for sequential operations
- Use `yield*` within generators to invoke effects and bind their results
- If you have more than 3-4 chained operations in a pipe, consider refactoring to `Effect.gen` for better readability
- Structure code in a linear, sequential flow for better readability
- Use the `.pipe()` method for pipeline building: `Effect.succeed("task").pipe(Effect.delay("200 millis"))`
- Create helper functions that return Effect values for reusable operations
- Break logic into small, reusable effects. Combine with `pipe`, `Effect.map`, `Effect.flatMap`, etc.

## Function Implementation Pattern
- Favor generators over "do simulation" and plain pipes for complex operations
- For multi-step operations, use the progression (from most to least preferred):
    1. `Effect.gen` with generators (most recommended)
    2. Plain pipe (least preferred due to nesting)
    3. "Do simulation" with `Effect.Do.pipe`
- Choose the right approach based on operation complexity
- Define small, focused utility functions that operate on effects
- Prefer functions over methods: Use standalone functions (e.g., `Effect.succeed`) over method chaining for tree-shaking and extensibility

## Promise Interoperability
- Use `Effect.promise` to wrap JavaScript Promises that won't reject (or handle rejections as defects)
- Use `Effect.tryPromise` for Promises that might reject, with explicit error mapping:
  ```typescript
  Effect.tryPromise({
    try: () => fetch("/api/data"),
    catch: (error) => new NetworkError({ cause: error })
  })
  ```
- Prefer Effect over Promises for application logic. Convert Promises to Effects at boundaries (API calls, library integrations)
- Always provide explicit error handling for Promise-based operations
- Avoid mixing raw Promise handling with Effect operations in the same code path

## Concurrency Control
- Use `Effect.all` for operating on arrays of effects with concurrency control
- Effects in `Effect.all` run sequentially by default. Use `{ concurrency: N }` or `{ concurrency: "unbounded" }` for parallel execution
- Be explicit about concurrency options when using parallel operations
- Use the appropriate concurrency model based on the use case:
    - Sequential (default): One after another
    - Bounded concurrency: Specify a number for maximum concurrent tasks
    - Unbounded: Use "unbounded" for maximum parallelism
    - Inherit: Use "inherit" to inherit concurrency settings from parent
- Use fibers for lightweight concurrency. Prefer `Effect.all` for parallel effects, `Effect.race` for timeouts
- Use `Effect.zip` to run two unrelated effects in parallel and combine their results. For sequential execution, use `Effect.flatMap` or `Effect.gen`

## Time and Duration
- Use the `Duration` module for time-related values instead of raw milliseconds
- Express durations as string literals for readability: `"200 millis"`, `"5 seconds"`
- Use `Duration.toMillis()` to convert to numeric values when needed
- Prefer Effect's timing utilities over raw JavaScript setTimeout/setInterval

## Avoiding Tacit Usage
- Write functions explicitly: `Effect.map((x) => fn(x))`
- Avoid point-free style: `Effect.map(fn)`
- Be explicit to ensure proper type inference and clearer stack traces
- Use explicit parameters even when functions could be passed directly

## Next.js Integration
- Wrap all logic in `Effect`. Use `@effect/platform-node/HttpServer` for custom servers if needed
- Use `Effect` for all fetches. Prefer server-side fetching in `getServerSideProps` or `generateStaticParams` wrapped in effects
- For Next.js App Router (React Server Components), use `Effect.runPromise` or `Effect.runPromiseExit` in async server components:
  ```typescript
  // app/users/page.tsx
  export default async function UsersPage() {
    const exit = await Effect.runPromiseExit(fetchUsers())
    if (Exit.isSuccess(exit)) {
      return <UsersList users={exit.value} />
    } else {
      return <ErrorDisplay error={exit.cause} />
    }
  }
  ```
- For Next.js API routes, use `NodeRuntime.runMain` for proper resource management:
  ```typescript
  // app/api/users/route.ts
  import { NodeRuntime } from "@effect/platform-node"
  
  export async function GET() {
    return NodeRuntime.runMain(
      fetchUsers().pipe(
        Effect.provide(AppLayer),
        Effect.map((users) => Response.json(users))
      )
    )
  }
  ```
- For optimistic UI updates in mutations (e.g., via React Query or custom state), use Effect's concurrency:
  - Perform optimistic update immediately
  - Run the effect in the background
  - Rollback on failure 
- Use Effect's async capabilities with `Suspense` boundaries. Wrap async effects in `Effect.runPromise` for React's async components
- Use `Effect.runPromiseExit` when you need to handle both success and failure cases without Promise rejection:
  ```typescript
  const exit = await Effect.runPromiseExit(program)
  if (Exit.isSuccess(exit)) {
    console.log(exit.value)
  } else {
    console.error(exit.cause)
  }
  ```

## Error Handling
- Place teardown logic in the main effect for proper resource release
- Use `Effect.addFinalizer` for cleanup operations
- Ensure graceful teardown when applications are interrupted
- Handle errors at the appropriate level of abstraction
- Use tagged errors for identification:
  ```typescript
  // Option 1: Using Data.TaggedError
  import { Data } from "effect"
  class MyError extends Data.TaggedError("MyError")<{ message: string }> {}
  
  // Option 2: Using Schema.TaggedError (preferred for Schema-based errors)
  import { Schema } from "effect"
  class MyError extends Schema.TaggedError<MyError>()("MyError", {
    message: Schema.String
  }) {}
  ```
- Use `Effect.withSpan` for tracing errors. Catch specific tags with `Effect.catchTag`
- Use `Effect.catchAll` for all errors, `Effect.catchSome` for partial error handling, `Effect.orElse` for fallback effects
- For network effects, use built-in retries: `Effect.retry(effect, Schedule.exponential("100 millis"))`
- Map internal errors to user-friendly messages. Use `Effect.orElseFail` for fallbacks

## Type Safety
- Use explicit type annotations when inference is insufficient
- Avoid type assertions when possible
- Leverage Effect's built-in error handling with proper typing
- Define custom error types for domain-specific errors
- No `any` types. Use Effect's type inference for effects, errors, and requirements
- Treat all operations as effects. Use pure functions where possible, and wrap side effects in `Effect` for composability
- Always use immutable data structures. Leverage Effect's utilities for updates (e.g., `Struct.evolve`)

## Schema and Validation
- Use `@effect/schema` for all data models (API responses, form inputs, props)
- Define schemas near data sources, apply refinements and transformations for business logic
- Always parse incoming data with `Schema.decodeUnknown` (returns Effect) or `Schema.decodeUnknownEither` (returns Either):
  ```typescript
  // Using Effect (recommended for Effect workflows)
  const user = yield* Schema.decodeUnknown(UserSchema)(rawData).pipe(
    Effect.mapError((error) => new ValidationError({ parseError: error }))
  )
  
  // Using Either (if you need Either instead of Effect)
  const either = Schema.decodeUnknownEither(UserSchema)(rawData)
  ```
- Use `Schema.encode` for encoding validated data back to external formats
- Use `Schema.validate` for validation without transformation
- Write unit tests for schemas to cover edge cases

## Logic and Control Flow
- Use declarative combinators:
  - Conditionals: `Effect.if`, `Effect.when`
  - Loops: `Effect.repeat`, `Effect.while`
  - Collections: `Effect.forEach`, `Effect.partition`
- Avoid imperative code: No `for` loops or `if` statements outside effects; compose instead
- For global state (e.g., auth), use Effect's layers and contexts. Integrate with React Context via providers

## Dependency Injection with Layers
- Compose layers with `Layer.merge` to combine multiple service layers:
  ```typescript
  const AppLayer = Layer.merge(DatabaseLayer, CacheLayer)
  ```
- Provide dependencies with `Effect.provide`:
  ```typescript
  const program = myEffect.pipe(Effect.provide(AppLayer))
  ```
- Use `Layer.provideMerge` to merge and provide in one step
- Layers handle resource acquisition and release automatically
- Services are shared by default (singleton behavior)

## Service Tags (Context.Tag)
- Use the modern `Effect.Tag` pattern for creating service tags (preferred):
  ```typescript
  class DatabaseService extends Effect.Tag("DatabaseService")<
    DatabaseService,
    { readonly query: (sql: string) => Effect.Effect<Result> }
  >() {}
  
  // Access service methods directly
  const result = yield* DatabaseService.query("SELECT * FROM users")
  ```
- Alternative: Use `Context.Tag` with a string identifier:
  ```typescript
  class DatabaseService extends Context.Tag("DatabaseService")<
    DatabaseService,
    { readonly query: (sql: string) => Effect.Effect<Result> }
  >() {}
  ```
- Use `Context.GenericTag` only when you need a custom identifier type
- Tags must have string keys for better debuggability

## Async/Sync Usage
- Treat sync and async uniformly with `Effect`. Use `Effect.sync` for pure sync code, `Effect.promise` or `Effect.tryPromise` for async
- Use `Effect.async` for callback-based APIs (Node.js style):
  ```typescript
  const readFile = (filename: string) =>
    Effect.async<Buffer, Error>((resume) => {
      fs.readFile(filename, (error, data) => {
        if (error) {
          resume(Effect.fail(error))
        } else {
          resume(Effect.succeed(data))
        }
      })
    })
  ```
- Always use `Effect.acquireRelease` or `Effect.acquireUseRelease` for resources (e.g., DB connections, file handles) to ensure cleanup
- Prefer `Effect.acquireUseRelease` when you have a clear "use" phase - it automatically handles scoping:
  ```typescript
  const program = Effect.acquireUseRelease(
    acquireDatabase(),
    (db) => db.query("SELECT * FROM users"),
    (db) => db.close()
  )
  ```
- Use `Effect.scoped` to manage resource lifecycles automatically when resources require `Scope`
- Use `Effect.using` to scope resources to another effect's lifetime:
  ```typescript
  const resource = acquireResource()
  const program = resource.pipe(Effect.using((res) => useResource(res)))
  ```

## Logging and Debugging
- Structure complex operations to make logging and tracing easier
- Log the start and completion of long-running tasks
- Consider wrapping logging in Effect operations for better composition
- Integrate with `@effect/platform/Log` for structured logging. In Next.js, log to console or external services like Sentry
- Enable built-in tracing with `Effect.withTracer`. Use OpenTelemetry integration for distributed tracing in Next.js apps

## Observability
- Use `@effect/platform/Metrics` to track effect durations, error rates, etc. Export to Prometheus or similar
- Configure log levels (debug, info, error) based on environment. In development, enable verbose tracing
- In production, integrate with tools like Datadog or New Relic. Log effect spans in API routes for request tracing

## Performance Considerations
- Follow Effect's patterns for resource management
- Use appropriate scheduling mechanisms
- Implement proper cancellation and interruption handling
- Optimize for both readability and performance
- Choose the appropriate concurrency model for your use case

## Testing
- Use `@effect/vitest` for testing Effect code
- Use `TestContext` for dependency injection in tests:
  ```typescript
  import { TestContext } from "@effect/vitest"
  const testLayer = TestContext.layer()
  ```
- Use `TestClock` for time control in tests
- Use `TestServices` for mocking services
- Test effects without execution using Effect's composable nature

## Resource Management Best Practices
- Always wrap scoped resources with `Effect.scoped` when the effect requires `Scope`
- Never forget to call `Effect.scoped` on effects that acquire resources - this is a common source of bugs
- Use `Effect.acquireUseRelease` instead of manual `acquireRelease` + `scoped` when you have a clear use phase
- Resources acquired with `Effect.acquireRelease` require `Scope` - always use `Effect.scoped` to provide it
- For long-running applications, consider using `ManagedRuntime` for better resource lifecycle management:
  ```typescript
  const runtime = yield* ManagedRuntime.make(AppLayer)
  const result = await runtime.runPromise(myEffect)
  await runtime.dispose() // Clean up when done
  ```
- Use `Layer.toRuntime` to convert a layer to a runtime when you need a persistent runtime instance

## Runtime Management
- Use `NodeRuntime.runMain` for Next.js API routes and server-side code - it handles cleanup automatically
- For one-off effects, use `Effect.runPromise` or `Effect.runPromiseExit` directly
- For long-running services, use `ManagedRuntime` to manage the runtime lifecycle
- Never create multiple runtimes unnecessarily - reuse the default runtime when possible
- Use `Runtime.defaultRuntime` for simple cases that don't need custom configuration

## Performance Optimization
- Use `Effect.fnUntraced` for performance-critical code where stack traces aren't needed:
  ```typescript
  const fastOperation = Effect.fnUntraced(function*() {
    // High-performance code without tracing overhead
    return yield* computeIntensiveTask()
  })
  ```
- Only use `fnUntraced` when profiling shows it's necessary - tracing is valuable for debugging
- Prefer composition over premature optimization

## Common Pitfalls to Avoid
- Mixing Effect and non-Effect code: Everything mutable or side-effecting must be in an Effect
- Using `Effect.void` unnecessarily: Use when you need to discard a value, but prefer explicit returns when the value might be useful later
- Ignoring requirements: Always provide layers for dependencies (e.g., HTTP client)
- Poor naming: Use descriptive effect names (e.g., `fetchUserData`)
- Using `Effect.runPromise` when `Effect.runPromiseExit` would be better for error handling
- **Forgetting `Effect.scoped`**: Effects that require `Scope` (from `acquireRelease`, `Layer.build`, etc.) must be wrapped with `Effect.scoped`
- **Running effects without providing dependencies**: Always check the `R` type parameter and provide required services
- **Not handling errors**: Use `Effect.catchAll`, `Effect.catchTag`, or `Effect.orElse` to handle errors appropriately
- **Creating resources without cleanup**: Always use `acquireRelease` or `acquireUseRelease` for resources that need cleanup
- **Mixing Promise and Effect error handling**: Convert Promises to Effects at boundaries, don't mix error handling strategies
