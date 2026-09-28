# Effect v4 Notes For Rift

This reference distills the most relevant findings from `/home/ari/repos/rift/reference/effect-smol`, which matches Rift's current `effect` dependency version: `4.0.0-beta.21`.

## Core patterns confirmed in `effect-smol`

- `Effect.fn("name")` is the preferred way to define reusable effectful functions.
- `Effect.gen(function* () { ... })` is the preferred control-flow style for imperative logic.
- `Schema.TaggedErrorClass` is the standard way to model typed domain errors.
- `ServiceMap.Service` is the default service construction API in v4.
- `ManagedRuntime` is the bridge from framework code into Effect programs.

These are documented directly in:

- `reference/effect-smol/LLMS.md`
- `reference/effect-smol/ai-docs/src/01_effect/01_basics/02_effect-fn.ts`
- `reference/effect-smol/ai-docs/src/03_integration/10_managed-runtime.ts`

## Practical v4 details worth remembering

### `Effect.fn`

- Adds tracing span information automatically, so the name string should stay stable and descriptive.
- Supports `Effect.fn.Return<Success, Error, Requirements>` when generator return types need annotation.
- Should be preferred over returning raw `Effect.gen(...)` functions from helpers.

### Services are yieldable

In v4, service keys implement the yieldable contract, so these are valid:

```ts
const repo = yield* TodoRepo
return yield* TodoRepo.use((service) => service.getById(id))
```

That makes service access inside generators much lighter than older tag-heavy styles.

### Typed recovery got better

Use these in preference order:

- `Effect.catchTag("Tag", handler)` for one error
- `Effect.catchTags({ TagA: ..., TagB: ... })` for multiple tagged errors
- `Effect.catchReason(...)` and `Effect.catchReasons(...)` only when you intentionally encode nested reason types inside a tagged error

Rift should usually stay on `catchTag` and `catchTags` unless there is a clear reason-modeling need.

### `ServiceMap.Reference`

`ServiceMap.Reference` is a v4 feature for defaults-backed references such as:

- feature flags
- config values
- current request metadata
- tracing toggles

It is useful when a value should exist even without explicit provision. It is not the first choice for domain services in Rift, where explicit service layers are clearer.

### `Layer.unwrap`

Use `Layer.unwrap(effectReturningLayer)` when the actual layer choice depends on:

- config
- effectful startup checks
- environment probing

That keeps the runtime wiring declarative while still allowing dynamic setup.

### `LayerMap.Service`

`LayerMap.Service` is new v4 infrastructure for dynamic keyed resources with caching and TTL behavior. It is appropriate for cases like:

- tenant-specific pools
- per-workspace clients
- keyed connectors that should be memoized and released when idle

Do not introduce it for ordinary fixed service graphs. Most Rift domains are still better served by static `Layer.mergeAll(...)`.

## Runtime guidance from `effect-smol`

The integration docs model the same broad pattern Rift uses:

1. Build service layers.
2. Create a shared `ManagedRuntime`.
3. Run programs from framework edges.
4. Dispose the runtime when the process shuts down.

Rift wraps that pattern in `makeRuntimeRunner(...)`, which also:

- merges server observability
- exposes `run` and `runExit`
- unwraps the first tagged failure when possible

## Useful unstable modules present in this version

The reference repo exposes these beta namespaces:

- `effect/unstable/http`
- `effect/unstable/httpapi`
- `effect/unstable/observability`
- `effect/unstable/sql`
- `effect/unstable/persistence`
- `effect/unstable/rpc`
- `effect/unstable/workflow`
- `effect/unstable/workers`

Treat them as available, not automatically approved. In Rift, prefer existing repo patterns first, and only introduce unstable modules when there is a concrete need and no established local abstraction already covers it.
