# Effect v4 Topic Map For Rift

Use this reference when the task needs more than Rift's default backend service/runtime pattern.

The rule is simple:

- For Rift architecture, start with the playbook and local backend examples.
- For Effect library behavior, read `reference/effect-smol/LLMS.md`, `reference/effect-smol/ai-docs/src`, and the matching `packages/effect/src` module.

## Source of truth

- `/home/ari/repos/rift/reference/effect-smol/LLMS.md`
- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/index.md`
- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src`

Do not prefer `node_modules` or random web docs when these local sources exist.

## Topic guide

### Core Effect style

Read these first for almost every backend task:

- `/home/ari/repos/rift/reference/effect-smol/LLMS.md`
- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/01_effect/01_basics/01_effect-gen.ts`
- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/01_effect/01_basics/02_effect-fn.ts`
- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/01_effect/02_services/01_service.ts`
- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src/ServiceMap.ts`

Use these for:

- `Effect.gen`
- `Effect.fn`
- `Schema.TaggedErrorClass`
- `ServiceMap.Service`
- `ServiceMap.Reference`

### Runtime integration

Read these when wiring Effect into framework handlers, workers, or adapters:

- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/03_integration/10_managed-runtime.ts`
- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src/ManagedRuntime.ts`

Map those patterns onto Rift's:

- `/home/ari/repos/rift/apps/start/src/lib/backend/server-effect/runtime/runtime-runner.ts`
- `/home/ari/repos/rift/apps/start/src/lib/backend/server-effect/runtime/server-runtime.ts`

### Error recovery

Read these when the task depends on typed recovery strategy:

- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/01_effect/03_errors/10_catch-tags.ts`
- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/01_effect/03_errors/20_reason-errors.ts`

Default for Rift:

- use `catchTag` for one tagged error
- use `catchTags` for several tagged errors
- use `catchReason` or `catchReasons` only when the domain intentionally models nested reasons

### HTTP client

Read these when building or wrapping outbound HTTP calls:

- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/50_http-client/10_basics.ts`
- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/50_http-client/index.md`
- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src/unstable/http/index.ts`
- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src/unstable/http/HttpClient.ts`
- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src/unstable/http/FetchHttpClient.ts`
- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src/unstable/http/HttpClientRequest.ts`
- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src/unstable/http/HttpClientResponse.ts`
- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src/unstable/http/HttpClientError.ts`

Use this stack when:

- you need a typed Effect-native HTTP client
- you want request or response transforms
- you want retry, tracing, headers, middleware, or response decoding to stay inside Effect

### HTTP server and HttpApi

Read these when the user explicitly wants Effect-driven server routing or schema-first HTTP APIs:

- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/51_http-server/10_basics.ts`
- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/51_http-server/index.md`
- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src/unstable/http/index.ts`
- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src/unstable/httpapi/index.ts`

Key exports to inspect:

- `HttpServer`
- `HttpRouter`
- `HttpMiddleware`
- `HttpApi`
- `HttpApiBuilder`
- `HttpApiClient`
- `HttpApiSchema`

For Rift specifically:

- prefer existing TanStack Start route patterns unless the task clearly benefits from introducing Effect's `HttpApi` stack
- do not switch a local route to `HttpApi` just because it exists

### SQL

There is no parallel `ai-docs` SQL chapter in this snapshot, so use the source directly:

- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src/unstable/sql/index.ts`
- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src/unstable/sql/SqlClient.ts`
- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src/unstable/sql/SqlConnection.ts`
- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src/unstable/sql/SqlSchema.ts`
- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src/unstable/sql/SqlResolver.ts`
- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src/unstable/sql/SqlModel.ts`
- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src/unstable/sql/SqlError.ts`
- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src/unstable/sql/Statement.ts`

What matters most:

- `SqlClient` is a service
- transactions are provided through `withTransaction(...)`
- `reserve` is scoped
- SQL tracing and transforms are built into the client abstraction

For Rift specifically:

- do not introduce Effect SQL just to replace an already-stable repo abstraction without a clear benefit
- if you do evaluate it, keep the integration behind a service boundary

### Resources and dynamic layers

Read these when startup or resource lifetime is part of the task:

- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/01_effect/04_resources/10_acquire-release.ts`
- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/01_effect/04_resources/20_layer-side-effects.ts`
- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/01_effect/04_resources/30_layer-map.ts`
- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/01_effect/02_services/20_layer-unwrap.ts`

Use these for:

- connection pools
- background tasks
- config-selected layers
- tenant-keyed resources

### Observability

Read these when logs, spans, or metrics are part of the design:

- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/08_observability/10_logging.ts`
- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/08_observability/20_otlp-tracing.ts`
- `/home/ari/repos/rift/reference/effect-smol/packages/effect/src/unstable/observability/index.ts`

For Rift specifically:

- prefer `Effect.fn` names and the server runtime observability layer first
- add custom spans only where they clarify expensive or cross-boundary work

### Testing

Read these when the task adds or restructures tests:

- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/09_testing/10_effect-tests.ts`
- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/09_testing/20_layer-tests.ts`
- `/home/ari/repos/rift/reference/effect-smol/ai-docs/src/09_testing/index.md`

Map those ideas into Rift with:

- `layerMemory`
- `layerNoop`
- runtime runner tests
- route or orchestrator flow tests

## Decision rule

If the question is "how should Rift backend code be structured?", use the playbook and local examples.

If the question is "how does this Effect v4 module work?", jump to the exact `effect-smol` topic above and read the source module directly.
