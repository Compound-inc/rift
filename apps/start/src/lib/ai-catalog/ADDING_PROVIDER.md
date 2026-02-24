# Adding a New AI Provider

This repo uses a typed, provider-local architecture for model metadata and runtime tools.
Follow these steps to add a provider safely and keep behavior predictable.

## 1. Install the provider SDK

From `apps/start`:

```bash
bun add @ai-sdk/<provider>
```

Use the provider package directly in backend tool factories. Do not build tools in shared orchestration code.

## 2. Verify model IDs and provider features

Preferred source is AI Gateway model list:

```bash
curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '[.data[] | select(.id | startswith("<provider>/")) | .id] | reverse | .[]'
```

If network is unavailable, use local provider docs in `node_modules/@ai-sdk/<provider>/docs/` and document that fallback in your PR.

## 3. Add provider tool metadata (UI/policy layer)

Create `apps/start/src/lib/ai-catalog/provider-tools/<provider>.ts` with:

- Tool IDs (as `as const` union)
- `ProviderToolDefinition[]` metadata (`name`, `description`, `advanced`)

Then update:

- `apps/start/src/lib/ai-catalog/provider-tools/index.ts`
  - Add provider tool import
  - Extend `CatalogProviderId`
  - Extend `ProviderToolIdByProvider`
  - Extend `getProviderToolDefinition()`

## 4. Add provider models (catalog layer)

Create `apps/start/src/lib/ai-catalog/providers/<provider>.ts` and export:

- `readonly AiModelCatalogEntry<'<provider>'>[]`
- Per-model capabilities
- `reasoningEfforts` / `defaultReasoningEffort`
- `providerOptionsByReasoning` only when needed
- `providerToolIds` for tools that model should expose

Keep defaults minimal. Only set options that differ from SDK/provider defaults.

## 5. Register provider models globally

Update `apps/start/src/lib/ai-catalog/index.ts`:

- Import new provider model list
- Append it to `AI_CATALOG`

## 6. Implement runtime provider tool factories

Create `apps/start/src/lib/chat-backend/provider-tools/<provider>.ts` with `ProviderToolRegistry<'<provider>'>`.

Rules:

- Keep all provider-specific tool wiring in this file
- Use `byId` map for static tool IDs
- Use `resolve` for versioned/dynamic tool IDs
- Return `undefined` when required runtime config is missing (graceful skip)

Then register it in:

- `apps/start/src/lib/chat-backend/provider-tools/index.ts`

Do not add provider-specific branching in `tool-registry.service.ts`.

## 7. Handle config-gated tools safely

For tools needing env configuration (e.g., vector stores, MCP endpoints):

- Read env vars in provider-local helper functions
- Validate/normalize values (trim, split, remove empties)
- Return `undefined` if config is incomplete

This prevents runtime failures while keeping tool visibility model-driven.

## 8. Verify org policy + UI integration

No extra UI code is usually required if `providerToolIds` and tool metadata are correct.
The existing pipeline already handles:

- Provider/model policy filtering
- Tool visibility labels
- Advanced-tool feature gating

## 9. Validate before merging

Run:

```bash
cd apps/start
bun run test
bunx tsc --noEmit
```

If `tsc` has unrelated pre-existing failures, confirm your changed files have no new errors.

## 10. PR checklist

- Provider package added
- Provider IDs typed in catalog unions
- Provider tool metadata + runtime registry added
- Models added to `AI_CATALOG`
- Env-gated tools fail closed (`undefined`)
- Tests pass
- Typecheck status documented
