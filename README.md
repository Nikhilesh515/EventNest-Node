# EventNest Backend

Node.js + Express + TypeScript backend for the EventNest event management platform. A modular monolith providing a REST API for event browsing, RSVP management, user administration, and role-based access control.

## About the Project

EventNest is a full-stack event planning application. This repository contains the backend API server responsible for all business logic, data persistence, authentication, and authorization.

**Core capabilities:**

- User registration and JWT-based authentication with refresh token rotation
- Role-based access control with 5 roles (User, Organizer, Moderator, Admin, SuperAdmin) and 15 granular permissions
- Event CRUD with lifecycle management (Draft → Published → Completed/Cancelled)
- RSVP system with capacity enforcement and per-user limits
- Tag system for event categorization
- Admin panels for user, role, permission, and tag management

**Tech stack:** Express 5, TypeScript 6, Knex.js, PostgreSQL 15, Redis 7, Zod, Vitest

## Engineering Decisions

### Express 5

Chosen for its widespread familiarity, explicit middleware pipeline, and native async error propagation. Express 5 eliminates the need for `express-async-errors` wrappers — thrown errors in async handlers are caught automatically.

### Knex.js over an ORM

Knex provides a SQL query builder with full query transparency. Every query is visible and predictable, avoiding the "magic" and N+1 pitfalls common with ORMs. Migrations are hand-written TypeScript files with complete control over schema evolution.

### Single PostgreSQL database

All modules share one database. This enables atomic transactions跨越 module boundaries (e.g., creating an RSVP and updating event capacity in one transaction), simplifies connection pooling, and keeps migration sets unified.

### Manual dependency injection

No DI framework. Each module exposes a `buildXxxModule()` factory that explicitly wires repositories, services, and routers. The entire object graph is readable in one file (`src/main.ts`), with no hidden bindings or decorator magic.

### Clean Architecture per module

Each of the 4 domain modules (auth, events, tags, rsvps) follows the same layered structure:

```
domain/     → Entity classes, domain errors, business rules
application/ → Service logic, repository interfaces (ports), DTOs
infrastructure/ → Knex repository implementations (adapters)
http/        → Express routes, controllers, Zod validation schemas
```

Dependencies point inward only. Domain and application layers have no knowledge of Express or Knex.

### Port/Adapter pattern

Cross-module communication uses TypeScript interfaces (ports) rather than direct imports. Modules expose `UserLookupPort`, `EventLookupPort`, `TagLookupPort`, `RsvpStatsPort`, and `CachePort`. The composition root in `main.ts` wires concrete implementations to these ports, enabling testability and loose coupling.

### Redis permission cache (not in JWT)

Permissions are resolved from the database and cached in Redis (or in-memory fallback) under key `user:{id}:permissions` with a 5-minute TTL. Keeping permissions out of the JWT means token payloads stay small and permission changes take effect immediately without reissuing tokens.

### Zod validation at HTTP edge

Zod schemas serve three purposes simultaneously: runtime request validation, TypeScript type inference, and OpenAPI specification generation via `zod-to-openapi`. One schema definition produces all three, eliminating duplication.

### Refresh token security

- Tokens are stored as SHA-256 hashes in the database (raw tokens never persisted)
- Rotation on every refresh with a configurable grace window (default 30s) for multi-tab scenarios
- Reuse detection: replaying a rotated token after the grace window revokes all active sessions for that user
- HttpOnly, SameSite=Lax cookie scoped to `/api/auth` path

### Consistent error envelope

All responses use a uniform envelope format:

```json
{
  "code": 200,
  "success": true,
  "message": null,
  "result": {},
  "errors": null
}
```

A typed error hierarchy (`AppError` → `ValidationError`, `NotFoundError`, `ConflictError`, etc.) maps domain errors to HTTP status codes automatically via the global error handler middleware.

### Fail-fast environment validation

All environment variables are validated at startup using Zod. If any required variable is missing or invalid, the process logs the error and exits immediately with code 1 — no partial boots.

## Setup

### Prerequisites

- Node.js >= 22
- npm >= 10
- PostgreSQL 15 (local install or Docker)
- Redis 7 (optional — falls back to in-memory cache)

### Local development

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
```

Set a real `JWT_SECRET` in `.env` (minimum 32 characters). All other defaults work for local development.

```bash
npm run db:migrate         # Run database migrations
npm run db:seed            # Seed initial data (roles, admin user, tags, events)
npm run dev                # Start with hot reload → http://localhost:5000
```

Verify:

```bash
curl http://localhost:5000/health
# { "status": "Healthy", "checks": { "postgres": "Healthy", "redis": "Healthy" } }
```

### Docker Compose

From the repository root (`EventNest-Exp/`):

```bash
docker compose up --build
```

This starts PostgreSQL, Redis, runs migrations and seeds automatically, and starts the API on port 5000.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Runtime environment (`development` / `test` / `production`) |
| `PORT` | `5000` | HTTP listen port |
| `DATABASE_URL` | `postgres://...@localhost:5433/eventnest` | PostgreSQL connection string |
| `TEST_DATABASE_URL` | `postgres://...@localhost:5433/eventnest_test` | Test database URL |
| `REDIS_URL` | _(empty)_ | Redis URL. When empty, uses in-memory cache |
| `CACHE_TTL_MINUTES` | `5` | Permission cache TTL in minutes |
| `DB_POOL_MIN` | `2` | Minimum pool connections |
| `DB_POOL_MAX` | `10` | Maximum pool connections |
| `DB_POOL_IDLE_MS` | `30000` | Idle connection timeout (ms) |
| `JWT_SECRET` | **required** | HMAC signing secret (min 32 characters) |
| `JWT_ISSUER` | `EventNest.AuthService` | JWT issuer claim |
| `JWT_AUDIENCE` | `EventNest` | JWT audience claim |
| `JWT_ACCESS_EXPIRY_MINUTES` | `60` | Access token lifetime |
| `JWT_REFRESH_EXPIRY_DAYS` | `30` | Refresh token lifetime |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `RATE_LIMIT_PER_MINUTE` | `100` | Global rate limit per IP |
| `LOG_LEVEL` | `info` | Pino log level |
| `OPENAPI_ENABLED` | `false` | Enable Swagger UI at `/api-docs` |
| `COOKIE_SECURE` | _(auto)_ | Secure flag on refresh cookie (auto-true in production) |
| `REFRESH_ROTATION_GRACE_SECONDS` | `30` | Grace window for rotated refresh tokens |

### Database migrations and seeds

```bash
npm run db:migrate         # Apply pending migrations
npm run db:rollback        # Rollback last migration batch
npm run db:rollback:all    # Rollback all migrations
npm run db:seed            # Run seed files (idempotent)
npm run db:reset           # Full reset: rollback all → migrate → seed
```

Seed data includes 5 roles, 1 admin user (`admin@eventnest.io` / `Admin@123`), 5 tags, and 3 sample events.

### Running tests

```bash
npm test                   # Single run
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage report
```

Tests require a running PostgreSQL instance with the `eventnest_test` database.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start with hot reload (`tsx watch src/main.ts`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled app (`node dist/main.js`) |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` | ESLint (flat config) |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier verify |
| `npm test` | Vitest single run |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Vitest with coverage |
| `npm run db:migrate` | Run migrations |
| `npm run db:seed` | Seed database |
| `npm run db:reset` | Full database reset |

## Assumptions

### Business and domain

- The application is designed for single-team or single-organization use — there is no multi-tenant or multi-organization support
- All events are free — there is no payment processing or ticketing
- No email or notification service — users are not notified of RSVPs, event updates, or role changes
- No file upload or storage — events have no images, banners, or attachments
- No real-time features — there are no WebSocket connections or live updates
- English only — no internationalization (i18n) or localization
- One RSVP per user per event — cancelled RSVPs can be reactivated in place
- Anonymous users can browse published events but cannot RSVP or create events
- Event lifecycle follows a fixed path: Draft → Published → Completed/Cancelled (no re-opening)
- Tags are global and shared across all events — they are not scoped to individual organizers
- Roles are fixed at 5 levels — beyond creating roles and assigning permissions, the role hierarchy is static
- Capacity is enforced as the sum of non-cancelled RSVP guest counts, not a hard per-RSVP limit

### Technical

- PostgreSQL is the only supported database — the schema uses PostgreSQL-specific features (CHECK constraints, UUID generation)
- Redis is optional — the system degrades gracefully to an in-memory cache with a warning log
- No CI/CD pipeline is configured in this repository
- No TLS termination at the API level — the server expects to run behind a reverse proxy (nginx, Caddy) in production
- The API must run on the same origin as the frontend for refresh cookies to work (or the cookie must use `SameSite=None; Secure`)
- Existing sessions from before the auth cookie migration are invalidated — users must log in again
