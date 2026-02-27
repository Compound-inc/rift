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

- `bun --bun vite dev --port 3000` from `apps/start`, or `bun run dev` from root (also starts `zero-cache`).
- The app boots without external services. The `ZeroProvider` gracefully falls back when `VITE_ZERO_CACHE_URL` is empty.
- Sending chat messages requires auth (WorkOS) and AI provider keys. Without them you'll see "Please sign in and try again."
- See `apps/start/.env.example` for all env vars. At minimum, create `apps/start/.env.local` with placeholder `WORKOS_*` values.

### Non-obvious caveats

- **Bun must be installed** (`curl -fsSL https://bun.sh/install | bash`). The repo specifies `packageManager: "bun@1.2.23"` but current Bun v1.3.x works fine.
- **Turbo `envMode: strict`** means env vars must be listed in `turbo.json` `globalPassThroughEnv` to be visible inside Turbo tasks.
- **Lint only runs for `web` (Next.js app)**. The `tanstack` app does not have a lint script. Pre-existing lint errors (22 errors, 15 warnings) exist in `apps/next`.
- **Tests**: `cd apps/start && bun run test` runs Vitest (8 tests currently). No test suite in `apps/next`.
- **`workers/markdown-converter`** is outside the workspace glob; run `bun install` separately there if needed.
- **Shared packages** (`@rift/ui`, `@rift/utils`) are built via `tsup`. Turbo's dependency graph handles building them before dependent apps' lint/build tasks.
