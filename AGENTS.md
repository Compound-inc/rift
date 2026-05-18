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

- You need to add well formatted documentation for the code you write, so future devs and underestend the code with ease
- DO NOT abuse comments and a way to "respond" to user question or request, they need to be real informatives
- DO NOT spam comments for irelevant code, only comment on code that needs explanation
- For complex logic or parts of a service, you can explain the implementation so future devs know why that code is the way it is

### Non-obvious caveats

- **`@rocicorp/zero-sqlite3` native binary**: After `bun install`, the `zero-cache-dev` process needs the native `better_sqlite3.node` binary. Run `npm run install` from the package directory to download the prebuilt binary via `prebuild-install`. With Bun, the package may live under `node_modules/.bun/@rocicorp+zero-sqlite3@<version>/node_modules/@rocicorp/zero-sqlite3` — use that path if `node_modules/@rocicorp/zero-sqlite3` does not exist. Without this step, `zero-cache` will crash with "Could not locate the bindings file."

## Agent skills

### Issue tracker

Linear (workspace `ucompound`, default team `COM`) via the `linear` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles, default names. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context. See `docs/agents/domain.md`.