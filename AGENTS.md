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

