<h1 align="center">Rift</h1>
<p align="center">High-performance AI chat infrastructure built for teams.</p>

<p align="center">
  <a href="https://rift.mx"><strong>Website</strong></a> ·
  <a href="#self-hosting"><strong>Deploy on Railway</strong></a> ·
  <a href="#self-hosting"><strong>Self-hosting</strong></a> ·
  <a href="./DEVELOPMENT.md"><strong>Local Development</strong></a>
</p>

## Introduction

Rift is a Bun + TanStack platform designed to make AI chat feel instant.

The core product goal is simple: maximize responsiveness and quality-of-life while preserving native provider behavior and enterprise-grade workspace controls.

Rift is built around TanStack Start, Rocicorp Zero for sync-first state and realtime updates, and the AI SDK for multi-provider support.

![Rift chat app screenshot](https://github.com/user-attachments/assets/3b5adbbd-06ef-4e8b-b6ae-7bafc5afdc61)

## Features

- Nested chat branches system with deterministic branch resolution and conflict handling

- BYOK controls (Bring Your Own Key) with organization-level enforcement
- Native provider tools routing and policy-aware tool gating
- ZDR (Zero Data Retention) compliance at provider level
- Team management via organizations, members, invitations, and role-based setting
- Stream resumability with Redis-backed resume lifecycle for reconnecting clients
- Sync-based architecture
- Organization-level model, tool, and compliance policy controls
- File uploads + markdown conversion pipeline supporting PDF, HTML/XML, Office, OpenDocument, CSV, and related document formats
- Vector retrieval pipeline (Qdrant) for attachment-aware RAG
- React Native mobile app currently in development (coming soon)

## Tech Stack

Rift is centered around this stack:

- [Bun](https://bun.sh/) - runtime, package management, and scripts
- [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) - full-stack React architecture
- [Rocicorp Zero](https://zero.rocicorp.dev/) - Sync-based data model and realtime cache layer
- [Effect] (https://effect.website/) - For all the Backend Logic and Services
- [Vercel AI SDK](https://ai-sdk.dev/) - multi-provider AI primitives and streaming
- [Railway](https://railway.com/) - default deployment target

Additional platform technologies:

- [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/), [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/)
- [Better Auth](https://www.better-auth.com/) for auth, organizations, invitations, and roles
- PostgreSQL + Redis for persistence and stream continuity
- Qdrant for vector search/RAG workflows
- Stripe + Resend for billing and email flows

## Self-Hosting

Rift will be deployable via a Railway template.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/qMdv3A?referralCode=0pCHYK&utm_medium=integration&utm_source=template&utm_campaign=generic)

More self-hosting deployment options will be documented soon.

## Repository Overview

This repository is a Bun + Turborepo monorepo.

- `apps/start/` - Primary Rift web app (TanStack Start + Vite)
- `packages/ui/` - Shared UI components
- `packages/utils/` - Shared utilities
- `packages/chat-scroll/` - Chat scrolling primitives
- `packages/tailwind-config/` - Shared Tailwind configuration
- `workers/markdown-converter/` - File-to-markdown Cloudflare Worker
- `reference/` - Upstream/reference snapshots (not active app code)

## Local Development

For detailed setup instructions, see **[DEVELOPMENT.md](./DEVELOPMENT.md)**.

### Setting up the Markdown Converter Worker (Required for file attachments)

Rift uses a Cloudflare Worker to convert uploaded files (PDFs, documents, etc.) to markdown. To set it up:

```bash
bun setup:markdown-worker
```

This interactive script will:

1. Check prerequisites (Node.js, wrangler CLI)
2. Authenticate with your Cloudflare account
3. Deploy the worker to Cloudflare
4. Generate and save a secure API token
5. Output the environment variables to add to your `.env` file

**Note:** You'll need a Cloudflare account. The worker runs on Cloudflare's free tier.

## Contributing

Contributions are welcome.

- Keep app-specific changes in `apps/*/src`
- Keep shared logic in `packages/*/src`
- Open an issue for bugs or feature proposals before large changes

## License

Rift is an open-core repository. The core technology is fully open source
under the GNU Affero General Public License v3.0 (AGPL-3.0), and the
enterprise surface under `apps/start/src/routes/(ee)` and `apps/start/src/ee`
is covered by a separate commercial license.

See [LICENSE](./LICENSE) for the AGPL terms and
[apps/start/src/ee/LICENSE.md](./apps/start/src/ee/LICENSE.md) for the
enterprise license.
