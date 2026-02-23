# Repository Guidelines

## Project Structure & Module Organization
This repo is a Bun + Turborepo monorepo.

- `apps/start`: TanStack Start app (Vite), main app source in `apps/start/src`, static files in `apps/start/public`.
- `apps/next`: Next.js app, source in `apps/next/src`, static files in `apps/next/public`.
- `packages/ui`, `packages/utils`, `packages/chat-scroll`, `packages/tailwind-config`: shared workspace packages.
- `reference/`: upstream/reference snapshots; do not treat as active app code.

Prefer changes in `apps/*/src` and `packages/*/src`. Keep shared logic in `packages/*` and app-specific logic in each app.

## Build, Test, and Development Commands
Run from repo root unless noted.

- `bun run dev`: start TanStack app dev pipeline (`turbo` filtered to `tanstack`).
- `bun run dev:next`: start Next.js app dev pipeline (`turbo` filtered to `web`).
- `bun run build` / `bun run build:next`: build TanStack or Next app.
- `bun run lint`: run workspace lint tasks.
- `bun run check`: run workspace checks.
- `bun run format` / `bun run format:check`: Prettier write/check.
- `cd apps/start && bun run test`: run Vitest tests for the TanStack app.

## Coding Style & Naming Conventions
- Language: TypeScript + React (ES modules), strict TS settings from `tsconfig.base.json`.
- Formatting: Prettier (`semi: false`, `singleQuote: true`, `trailingComma: all` in `apps/start/prettier.config.js`).
- Linting: ESLint 9 (`eslint-config-next` at root, `@tanstack/eslint-config` in `apps/start`).
- Naming: components `Kebab-Case.tsx`, hooks `use-*.ts(x)` or `use*.ts(x)`, route files follow framework conventions.

## Testing Guidelines
- Framework: Vitest is configured in `apps/start` (`bun run test` there).
- Current state: there are few/no committed app tests yet.
- Add tests as `*.test.ts` / `*.test.tsx`, colocated with code in `apps/start/src` (or package `src` for shared logic).

## Commit & Pull Request Guidelines
- Recent commits follow short imperative summaries (for example: `Refactor ...`, `Add ...`, `Update ...`).
- Use clear, scoped commit messages: `feat(chat): add upload validation`.
- PRs should include:
  - what changed and why,
  - impacted paths (example: `apps/start/src/components/chat/*`),
  - linked issue/ticket,
  - screenshots or short recordings for UI changes.

## Security & Configuration Tips
- Keep secrets in local env files (for example `.env.local`); never commit credentials.
- `turbo.json` passes through deployment/env keys (Convex, WorkOS, Sentry, Redis). Document any new required variables in your PR.

## Comments in code
- You need to add comprehensive documentation for the code you write, so future devs and underestend the code with ease
- DO NOT abuse comments and a way to "respond" to user question or request, they need to be real informatives
- DO NOT spam comments for irelevant code 