---
name: rift-backend-effect
description: Use when adding, reviewing, or refactoring backend code in Rift's TanStack Start app that should follow `apps/start/BACKEND_EFFECT_PLAYBOOK.md`. Covers Rift's Effect v4 service architecture, tagged domain errors, centralized runtime wiring, thin route boundaries, and when to consult deeper Effect references for HttpClient, HttpApi, SQL, testing, and observability.
---

# Rift Backend Effect

Use this skill for backend work in `/home/ari/repos/rift/apps/start` when the change touches Effect services, runtimes, route handlers, or shared server-only infrastructure.

This skill is intentionally specific to Rift's backend architecture. It is not meant to inline the whole Effect v4 library. For broader library guidance, use the topic references listed below and read directly from `reference/effect-smol`.

Do not use this skill for frontend-only work or generic TypeScript questions that do not need Rift's backend conventions.

## First Read

Start with these sources in order:

1. `apps/start/BACKEND_EFFECT_PLAYBOOK.md`
2. The nearest backend domain under `apps/start/src/lib/backend/*` or `apps/start/src/ee/*/backend`
3. [references/effect-v4-notes.md](./references/effect-v4-notes.md) when you need Effect v4 API guidance
4. [references/effect-v4-topic-map.md](./references/effect-v4-topic-map.md) when you need module-specific guidance such as HttpClient, HttpApi, SQL, observability, or testing
5. [references/rift-backend-examples.md](./references/rift-backend-examples.md) when you need repo examples

## Default Shape

For each backend domain, prefer:

- `domain/`
- `http/`
- `runtime/`
- `services/`

If a service grows past roughly 300-400 lines or mixes unrelated workflows, split it into:

- `services/<service-name>/helpers.ts`
- `services/<service-name>/operations/<operation>.ts`

## Working Rules

- Define services with `ServiceMap.Service<...>()("namespace/Service")`.
- Implement public service methods with `Effect.fn("Service.method")`.
- Use `Effect.gen` for imperative flow and add typed recovery with combinators such as `catchTag`, `catchTags`, and `mapError`.
- Keep tagged domain errors close to the domain in `domain/errors.ts`.
- Expose implementations as static class properties on the service:
  - `layer`
  - `layerMemory` for deterministic tests
  - `layerNoop` when noop behavior is explicit
- Do not create `*Live` or `*Memory` free-floating layer constants.
- Do not wrap service layers in `namespace` objects.
- Compose one runtime per backend domain in `runtime/*-runtime.ts` with `Layer.mergeAll(...)` and `makeRuntimeRunner(...)`.
- Keep route files and `createServerFn` handlers thin. They should parse input, build one program, and run it via a shared runtime.
- Reuse `src/lib/backend/server-effect` helpers before creating new auth, runtime, detached-work, or database access utilities.

## Implementation Workflow

### 1. Shape the boundary

- Decide whether the work belongs in an existing backend domain or a new one.
- Keep request parsing, auth extraction, and response mapping at the route boundary.
- Keep business rules and orchestration in services.

### 2. Model errors first

- Create explicit tagged errors with `Schema.TaggedErrorClass`.
- Preserve typed error channels through the service layer.
- Map infrastructure failures once, near the boundary that introduces them.

### 3. Build the service

Use this default pattern:

```ts
import { Effect, Layer, ServiceMap } from 'effect'

export type ExampleServiceShape = {
  readonly doThing: (input: { readonly id: string }) => Effect.Effect<void, ExampleError>
}

export class ExampleService extends ServiceMap.Service<
  ExampleService,
  ExampleServiceShape
>()('example-backend/ExampleService') {
  static readonly layer = Layer.succeed(this, {
    doThing: Effect.fn('ExampleService.doThing')(({ id }) =>
      Effect.gen(function* () {
        void id
      }),
    ),
  })
}
```

Default to `Layer.succeed(this, { ... })` for straightforward services. Use `Layer.effect(...)` when service construction must allocate state, read config, or acquire resources.

### 4. Wire the runtime once

Create one runtime module per domain:

```ts
import { Layer } from 'effect'
import { makeRuntimeRunner } from '@/lib/backend/server-effect'

const layer = Layer.mergeAll(
  DepA.layer,
  DepB.layer,
  FeatureService.layer,
)

const runtime = makeRuntimeRunner(layer)

export const DomainRuntime = {
  layer,
  run: runtime.run,
  runExit: runtime.runExit,
  dispose: runtime.dispose,
}
```

If a route only needs framework-boundary helpers and no domain services, use `ServerRuntime` instead of inventing a new runtime.

### 5. Prefer shared server-effect helpers

Reach for these before writing new infrastructure glue:

- `requireUserAuth(...)`
- `requireOrgAuth(...)`
- `ZeroDatabaseService`
- `makeRuntimeRunner(...)`
- detached runtime helpers in `server-effect/runtime/detached`

### 6. Keep route handlers thin

- Parse request data and normalize input.
- Build one `program` effect.
- Execute with `<Domain>Runtime.run(program)` or `ServerRuntime.run(program)`.
- Convert failures to transport responses with the domain's failure mapper.

### 7. Test the service boundary

For backend changes, aim to cover:

- service happy path
- typed failure path
- input normalization when relevant
- runtime or integration flow for new orchestration

Use `layerMemory` and `layerNoop` to keep tests deterministic.

## Effect v4 Notes

- `yield* ServiceClass` works because services are yieldable in Effect v4.
- `Effect.fn("name")` already adds tracing span metadata, so stable names matter.
- `Effect.fn.Return<Success, Error, Requirements>` is useful when generator return types get hard to read.
- `ServiceMap.Reference` is for config values and feature flags with defaults, not as the default replacement for domain services.
- `Layer.unwrap` is the right tool when the chosen implementation depends on config or effectful initialization.
- `LayerMap.Service` is available for keyed dynamic resources, but use it only when the problem is truly dynamic, such as tenant-scoped pools.

## When To Leave This Skill And Read Deeper References

Read [references/effect-v4-topic-map.md](./references/effect-v4-topic-map.md) when the task depends on library details beyond Rift's standard service/runtime pattern, especially:

- `effect/unstable/http` or `HttpClient`
- `effect/unstable/httpapi` server definitions
- `effect/unstable/sql`
- observability or tracing exports
- Effect-specific testing utilities

If a topic is not covered by this skill's body, prefer the `effect-smol` source and `ai-docs` tree over external docs or `node_modules`.

## Review Checklist

- Service methods use `Effect.fn` with stable names.
- Domain errors are explicit tagged classes.
- Runtime composition is centralized in one `*-runtime.ts`.
- Routes are thin and execute one runtime program.
- Shared server-effect helpers are reused instead of cloned.
- Large services are split into operations/helpers.
- Tests cover happy path and typed failure path.
