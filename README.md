# EventNest API (Node.js)

Node.js + Express + TypeScript rewrite of the EventNest backend as a **modular monolith**.
The React frontend (`EventNest-UI`) is unchanged and consumes this API's frozen contract.

Full documentation lives in [`docs-exp/`](../docs-exp/README.md) — start with the
[API Reference](../docs-exp/Architecture%20Plan/11-API-Reference.md) and
[Implementation Plan](../docs-exp/Architecture%20Plan/12-Implementation-Plan.md).

**Status:** M0012 complete — Auth cookie hardening (refresh token moved to an HttpOnly cookie, rotation with grace window and reuse detection).

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

## Auth contract

| Concern         | Behaviour                                                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access token    | HS256 JWT returned in the response body (`accessToken`, 60 min). The UI keeps it **in memory only**.                                                                                     |
| Refresh token   | Opaque token sent **only** as the `eventnest.refresh_token` cookie. Never in response bodies.                                                                                            |
| Cookie flags    | `HttpOnly; SameSite=Lax; Path=/api/auth` + `Max-Age` from `JWT_REFRESH_EXPIRY_DAYS`; `Secure` when `COOKIE_SECURE=true` or `NODE_ENV=production`.                                        |
| Rotation        | Every successful refresh revokes the presented token (recording `replaced_by_token_hash`) and issues a new one.                                                                          |
| Grace window    | For `REFRESH_ROTATION_GRACE_SECONDS` (default 30) a just-rotated token may be re-exchanged (multi-tab race). The old row is not mutated, so the window cannot be extended.               |
| Reuse detection | Replaying a rotated token after the grace window revokes **all** active tokens for the user (theft response). Tokens revoked by logout are terminal and never trigger family revocation. |
| Origin check    | `/api/auth/refresh` and `/api/auth/logout` reject requests whose `Origin` is not in `CORS_ORIGINS` (403). Requests without `Origin` (curl, mobile) are allowed.                          |
| CORS            | Credentialed requests are enabled against the explicit `CORS_ORIGINS` list — never `*`.                                                                                                  |

```bash
# Login: cookie lands in the jar, token stays in the body
curl -s -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@eventnest.io","password":"Admin@123"}'

# Refresh with the cookie only (no body)
curl -s -b cookies.txt -c cookies.txt -X POST http://localhost:5000/api/auth/refresh

# Logout revokes the cookie session and clears the cookie
curl -s -b cookies.txt -X POST http://localhost:5000/api/auth/logout
```

> **Deployment notes**
>
> - The SPA must be served **same-origin** behind the API (dev: the Vite proxy; prod: one reverse proxy). If the UI lives on a different site, the cookie needs `SameSite=None; Secure` and the origin must be in `CORS_ORIGINS`.
> - Existing sessions from before the cookie migration are invalidated once: users log in again and their browsers drop the legacy `localStorage` tokens (the UI cleans them up on boot).

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
