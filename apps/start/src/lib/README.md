# `lib` Architecture

`lib` is organized by execution layer first, then by domain:

- `backend/<domain>`: Server-only business logic, orchestrators, runtimes, persistence adapters, and HTTP error mapping.
- `frontend/<domain>`: Client-facing hooks and server function adapters used by UI routes/components.
- `shared/<domain>`: Isomorphic contracts and pure logic safe to import from both backend and frontend.

## Backend domain shape

Each backend domain should follow this structure when applicable:

- `domain/`: Core types, domain errors, domain policies.
- `services/`: Service boundaries and implementations.
- `runtime/`: Layer wiring and runtime bootstrapping.
- `http/` (optional): Route-specific error serialization or helpers.
- `infra/` (optional): Infrastructure clients/adapters.
- `index.ts`: Stable public exports.

## Import boundaries

- Frontend code must not import from `lib/backend/**`.
- Backend code must not import from `lib/frontend/**`.
- Cross-layer shared logic belongs in `lib/shared/**`.

This keeps execution boundaries explicit
