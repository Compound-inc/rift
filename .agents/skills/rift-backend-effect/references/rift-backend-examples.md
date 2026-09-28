# Rift Backend Examples

Use these files as the canonical local examples when implementing or reviewing backend Effect code in Rift.

## Playbook

- `/home/ari/repos/rift/apps/start/BACKEND_EFFECT_PLAYBOOK.md`

This is the repo-level contract. Follow it before copying any individual implementation.

## Shared runtime and infra

- `/home/ari/repos/rift/apps/start/src/lib/backend/server-effect/runtime/runtime-runner.ts`
  - wraps `ManagedRuntime.make(...)`
  - merges server observability
  - exposes `run`, `runExit`, and `dispose`
  - unwraps the first tagged failure for framework callers

- `/home/ari/repos/rift/apps/start/src/lib/backend/server-effect/runtime/server-runtime.ts`
  - generic runtime for route-level programs that only need boundary helpers

- `/home/ari/repos/rift/apps/start/src/lib/backend/server-effect/http/server-auth.ts`
  - `requireUserAuth(...)`
  - `requireOrgAuth(...)`
  - `requireNonAnonymousUserAuth(...)`

- `/home/ari/repos/rift/apps/start/src/lib/backend/server-effect/services/zero-database.service.ts`
  - shared database access wrapper
  - good example of a small infra service built with `ServiceMap.Service`

## Runtime composition

- `/home/ari/repos/rift/apps/start/src/lib/backend/chat/runtime/chat-runtime.ts`
  - best example of a larger domain runtime
  - uses `Layer.mergeAll(...)`
  - provides cross-service dependencies with `Layer.provideMerge(...)`
  - exports one runtime object for the whole backend domain

- `/home/ari/repos/rift/apps/start/src/lib/backend/org-knowledge/runtime/org-knowledge-runtime.ts`
- `/home/ari/repos/rift/apps/start/src/lib/backend/billing/runtime/workspace-billing-runtime.ts`

Use these to keep new runtime files shaped consistently.

## Service examples

- `/home/ari/repos/rift/apps/start/src/lib/backend/billing/services/workspace-usage-quota.service.ts`
  - compact service example
  - shows `layer`, `layerNoop`, and `layerMemory`
  - good model for persistence wrappers with typed remapping

- `/home/ari/repos/rift/apps/start/src/lib/backend/chat/services/chat-orchestrator.service.ts`
  - good orchestration example
  - use as a reference when a service coordinates many dependencies

- `/home/ari/repos/rift/apps/start/src/lib/backend/chat/services/message-store/operations/*.ts`
  - best example of splitting a large service into operation modules

- `/home/ari/repos/rift/apps/start/src/lib/backend/org-knowledge/services/org-knowledge-repository.service.ts`
  - repository-style service with multiple related operations

## Domain errors

- `/home/ari/repos/rift/apps/start/src/lib/backend/billing/domain/errors.ts`
- `/home/ari/repos/rift/apps/start/src/lib/backend/org-knowledge/domain/errors.ts`
- `/home/ari/repos/rift/apps/start/src/ee/singularity/backend/domain/errors.ts`

These show the expected `Schema.TaggedErrorClass` pattern and the kind of stable context fields Rift includes.

## Thin route examples

- `/home/ari/repos/rift/apps/start/src/routes/api/chat/route.tsx`
  - parses request
  - performs auth at the edge
  - builds one effect program
  - executes through `ChatRuntime.run(...)`
  - maps thrown tagged failures back to transport responses

- `/home/ari/repos/rift/apps/start/src/routes/api/zero/query/route.tsx`
- `/home/ari/repos/rift/apps/start/src/routes/api/org/model-policy/route.tsx`

## Local heuristics

- If the code only adapts an SDK or async API, keep it as a small infrastructure helper and wrap calls with `Effect.try` or `Effect.tryPromise` at the service boundary.
- If the code decides business rules, authorization outcomes, quota behavior, or orchestration flow, it belongs in an Effect service.
- If a route starts owning business logic, move that logic down into a service and keep the route as transport glue.
