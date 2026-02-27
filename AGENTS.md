# Repository Guidelines

## Project Structure & Module Organization

This repo is a Bun + Turborepo monorepo.

- `apps/start`: TanStack Start app (Vite), main app source in `apps/start/src`, static files in `apps/start/public`.
- `packages/ui`, `packages/utils`, `packages/chat-scroll`, `packages/tailwind-config`: shared workspace packages.
- `reference/`: upstream/reference snapshots; do not treat as active app code.

Prefer changes in `apps/*/src` and `packages/*/src`. Keep shared logic in `packages/*` and app-specific logic in each app.

## Build, Test, and Development Commands

Run from repo root unless noted.

- `bun run lint`: run workspace lint tasks.
- `bun run check`: run workspace checks.
- `cd apps/start && bun run test`: run Vitest tests for the TanStack app.

## Naming Conventions

- Naming: components `Kebab-Case.tsx`, hooks `use-*.ts(x)` or `use*.ts(x)`, route files follow framework conventions.

## Testing Guidelines

- Framework: Vitest is configured in `apps/start` (`bun run test` there).
- Current state: there are few/no committed app tests yet.
- Add tests as `*.test.ts` / `*.test.tsx`, colocated with code in `apps/start/src` (or package `src` for shared logic).

## Comments in code

- You need to add comprehensive documentation for the code you write, so future devs and underestend the code with ease
- DO NOT abuse comments and a way to "respond" to user question or request, they need to be real informatives
- DO NOT spam comments for irelevant code 
- For complex logic or parts of a service, you can explain the implementation so future devs know why that code is the way it is

## Cursor Cloud specific instructions

### Services overview

| App | Name | Stack | Dev command |
|---|---|---|---|
| `apps/start` | tanstack | TanStack Start (Vite + Nitro/Bun) | `bun --bun vite dev --port 3000` (from `apps/start`) |
| `apps/next` | web | Next.js 16 + Convex | `bun run --bun next dev` (from `apps/next`) |
| `packages/*` | shared libs | `@rift/ui`, `@rift/utils`, `@rift/chat-scroll`, `@rift/tailwind-config` | Built automatically via Turbo dependency graph |

The primary app is `apps/start` (TanStack Start). The `apps/next` app is a secondary/legacy Next.js app.

### Running the primary app (`apps/start`)

- **Always start from the repo root** with `bun run dev`. This runs Turbo which starts both the Vite dev server (port 3000) and `zero-cache-dev` together.
- Zero requires a separate `apps/start/.env` file (not `.env.local`) with `ZERO_UPSTREAM_DB`, `VITE_ZERO_CACHE_URL`, `ZERO_QUERY_URL`, `ZERO_MUTATE_URL`, and cookie-forwarding flags. See `apps/start/.env.example` for the full template.
- Sending chat messages requires auth (WorkOS) and AI provider keys. Without them you'll see "Please sign in and try again."
- Additional app-specific overrides go in `apps/start/.env.local` (e.g. `WORKOS_*` placeholders).

### Non-obvious caveats

- **Bun must be installed** (`curl -fsSL https://bun.sh/install | bash`). The repo specifies `packageManager: "bun@1.2.23"` but current Bun v1.3.x works fine.
- **`@rocicorp/zero-sqlite3` native binary**: After `bun install`, the `zero-cache-dev` process needs the native `better_sqlite3.node` binary. Run `cd node_modules/@rocicorp/zero-sqlite3 && npm run install` to download the prebuilt binary via `prebuild-install`. Without this, `zero-cache` will crash with "Could not locate the bindings file."
- **Zero needs a separate `.env` file** (not `.env.local`) at `apps/start/.env` with `ZERO_UPSTREAM_DB`, `VITE_ZERO_CACHE_URL`, `ZERO_QUERY_URL`, `ZERO_MUTATE_URL`, and cookie-forwarding flags.
- **Always start via `bun run dev` from the repo root** so Turbo runs both the Vite dev server (port 3000) and `zero-cache-dev` (port 4848) together.
- **Turbo `envMode: strict`** means env vars must be listed in `turbo.json` `globalPassThroughEnv` to be visible inside Turbo tasks.
- **Lint only runs for `web` (Next.js app)**. The `tanstack` app does not have a lint script. Pre-existing lint errors (22 errors, 15 warnings) exist in `apps/next`.
- **Tests**: `cd apps/start && bun run test` runs Vitest (8 tests currently). No test suite in `apps/next`.
- **`workers/markdown-converter`** is outside the workspace glob; run `bun install` separately there if needed.
- **Shared packages** (`@rift/ui`, `@rift/utils`) are built via `tsup`. Turbo's dependency graph handles building them before dependent apps' lint/build tasks.
