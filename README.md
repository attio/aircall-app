# aircall

Attio app integrating with [Aircall](https://aircall.io) — a cloud phone and call-center platform.

## What it does

Place calls and manage Aircall telephony from inside Attio. Click-to-call people and companies from record pages, add phone numbers to dialer campaigns in bulk, send SMS messages, and trigger Attio workflows from inbound Aircall activity. Call and message activity is logged back to Attio as notes.

## Features

- **Record actions** — click-to-call a person or company directly from an Attio record page
- **Bulk record action** — add the phone numbers of multiple records to an Aircall dialer campaign at once
- **Workflow blocks** — add numbers to a dialer campaign and send SMS messages as workflow steps
- **Workflow triggers** — start workflows when an Aircall call ends or an inbound message is received
- **Webhooks** — Aircall webhooks are registered automatically on connect and removed on disconnect

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm run dev
```

## Commands

| Command                 | Description              |
| ----------------------- | ------------------------ |
| `pnpm run dev`          | Start dev server         |
| `pnpm run build`        | Build + type-check       |
| `pnpm run lint`         | Run ESLint               |
| `pnpm run lint:fix`     | Run ESLint with auto-fix |
| `pnpm run format`       | Format with Prettier     |
| `pnpm run format:check` | Check formatting         |
| `pnpm run test`         | Run tests                |
| `pnpm run knip`         | Check for dead code      |

## Source folder structure

| Path                     | Description                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `src/app.ts`             | App manifest — declares record actions and bulk actions.                             |
| `src/aircall-api/`       | Aircall REST API client, endpoints, Zod schemas, auth/url helpers, error mapping.    |
| `src/blocks/`            | Workflow step and trigger blocks (one folder per block).                             |
| `src/webhooks/`          | Inbound Aircall webhook handler.                                                     |
| `src/events/`            | Connection lifecycle handlers that register/deregister the Aircall webhook.          |
| `src/server/`            | Server-only data fetchers (Aircall numbers, users).                                  |
| `src/queries/`           | GraphQL queries for reading Attio record phone numbers / current user.               |
| `src/utils/`             | Shared helpers (logger).                                                             |
| `src/assets/`            | App icon and static assets.                                                          |

See [AGENTS.md](./AGENTS.md) for full SDK usage notes and coding guidelines.
