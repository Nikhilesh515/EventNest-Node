# EventNest API (Node.js)

Node.js + Express + TypeScript rewrite of the EventNest backend as a **modular monolith**.
The React frontend (`EventNest-UI`) is unchanged and consumes this API's frozen contract.

Full documentation lives in [`docs-exp/`](../docs-exp/README.md) — start with the
[API Reference](../docs-exp/Architecture%20Plan/11-API-Reference.md) and
[Implementation Plan](../docs-exp/Architecture%20Plan/12-Implementation-Plan.md).

**Status:** Phase P0 — scaffold only (health endpoint; no database, modules, or middleware chain yet).

## Prerequisites

- Node.js 22 LTS or newer
- npm 10 or newer
- Docker Desktop (needed from phase P2 for PostgreSQL and Redis)

## Setup

```bash
npm install
cp .env.example .env   # Windows: copy .env.example .env
```

Set a real `JWT_SECRET` (at least 32 characters) in `.env`. All other defaults work for local development.

## Run

```bash
npm run dev            # tsx watch, http://localhost:5000
```

Verify:

```bash
curl http://localhost:5000/health
# { "status": "Healthy", "checks": [] }
```

## Scripts

| Script                            | Purpose                                         |
| --------------------------------- | ----------------------------------------------- |
| `npm run dev`                     | Start with hot reload (`tsx watch src/main.ts`) |
| `npm run build`                   | Compile TypeScript to `dist/`                   |
| `npm start`                       | Run the compiled app (`node dist/main.js`)      |
| `npm run typecheck`               | Type-check without emitting                     |
| `npm run lint`                    | ESLint (flat config, typescript-eslint)         |
| `npm run format` / `format:check` | Prettier write / verify                         |
| `npm run test` / `test:watch`     | Vitest (wired in phase P1)                      |

## Layout (so far)

```
src/
├─ main.ts                          # bootstrap: env → app → listen → graceful shutdown
├─ app.ts                           # createApp(deps): pure Express factory
├─ config/env.ts                    # zod-validated environment (fail fast)
└─ shared/infrastructure/logger.ts  # pino logger factory
```

## Environment

See [`.env.example`](.env.example) for every supported variable. The canonical reference is
[README § Canonical contract facts](../docs-exp/README.md#6-canonical-contract-facts).
