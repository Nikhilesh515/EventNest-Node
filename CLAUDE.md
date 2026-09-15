# EventNest-Node — Development Workflow

> This document governs how every milestone is built in this repository.
> It is the single source of truth for the development process.

---

## Core Principle

Every milestone follows the same cycle: **Analyze → Explore → Document → Validate → Implement → Test → Gate**. No step is skipped. No code is merged without passing tests. No milestone is started before the previous one's gate is green.

---

## The Cycle (per milestone)

### 1. Analyze

Read the relevant architecture docs and implementation plan to understand:

- What is being built (scope, deliverables)
- What it depends on (previous milestones, existing code)
- What acceptance criteria define "done"
- What constraints apply (frozen UI contract, permission model, error semantics)

**Files to read:** `docs-exp/Architecture Plan/12-Implementation-Plan.md` (milestone map), the relevant module docs (03, 04, 05, 06, 07, 11), and the previous milestone's test plan results.

### 2. Explore (sub-agents)

If the task involves unfamiliar territory or cross-cutting concerns, dispatch explore sub-agents to deep-dive into specifics. Synthesize their findings into a concrete plan before writing documentation.

### 3. Document first

Create a milestone folder in `docs-exp/`:

```
docs-exp/000X-milestone-<name>/
├── 01-FRS.md                  # Functional Requirements Specification
├── 02-Implementation-Plan.md  # File-level steps with TS code sketches
├── 03-Implementation-Phases.md # Phases with entry/exit criteria
└── 04-Test-Plan.md            # Test cases + results table (empty until gate)
```

**FRS rules:**

- Every requirement has an ID (`FR-<GROUP>-NNN`)
- Every FR has acceptance criteria
- Every FR is traceable to a test case (`TC-<GROUP>-NNN`)
- Out-of-scope items are explicitly listed
- Known deviations from architecture docs are recorded

**Implementation Plan rules:**

- Steps are numbered and file-specific
- Each step includes TypeScript code sketches (real signatures, not pseudocode)
- Files Changed Summary table
- Verification Checklist with exact commands

**Phases rules:**

- Each phase has: Tasks, Entry Criteria, Exit Criteria, Deliverables
- Phases are ordered so each is independently verifiable
- Summary table with estimates

**Test Plan rules:**

- Every FR covered by at least one TC
- TC format: `### TC-<GROUP>-NNN: Name` with Field/Value table (Description, Type, Steps, Expected, FR)
- Results table (all "Not run" until gate)
- Verification Commands section with exact bash

### 4. Validate documentation

Before writing any code, verify the docs:

- [ ] Every FR ID in the FRS appears in the Implementation Plan, Phases, and Test Plan
- [ ] Every TC in the Test Plan maps back to at least one FR
- [ ] All internal doc links resolve (`../Architecture Plan/...`, `../README.md`)
- [ ] No .NET terminology appears as current choices (only in contrast/mapping tables)
- [ ] Cross-references between docs-exp architecture docs and milestone docs are consistent
- [ ] Acceptance criteria in the FRS match the gate in the Test Plan

### 5. Implement

Code the milestone following the Implementation Plan:

- Phase by phase (e.g., Phase A → Phase B → Phase C)
- For each file: write code → format → lint
- Each phase ends with a mini-verification (subset of tests green)
- Sub-agents can implement independent phases in parallel
- **No try-catch in controllers** (error flow: throw → middleware → envelope)
- **Validate at the edge** (zod schemas co-located with routes)
- **Follow existing patterns** (check `src/shared/` for conventions)

### 6. Test faithfully

- Run the full test suite after every phase
- Run coverage gate at the end: `npm run test:coverage`
- If the milestone touches Redis, run opt-in parity: `REDIS_URL=... npm run test`
- **Before UI is available:** test via supertest contract tests and manual curl
- **After UI is available:** Playwright MCP tests against the real backend (no mocks)
- Fill the Test Plan Results table with actual outcomes

### 7. Gate (definition of done)

A milestone is complete only when ALL of these pass:

- [ ] `npm run typecheck` — clean
- [ ] `npm run lint` — clean
- [ ] `npm run format:check` — clean
- [ ] `npm run build` — produces `dist/`
- [ ] `npm run test` — all mandatory tests green
- [ ] `npm run test:coverage` — lines ≥ threshold on relevant `src/`
- [ ] Health endpoint still works
- [ ] Test Plan Results table filled
- [ ] Documentation drift items resolved (amend architecture docs if needed)
- [ ] No regressions on previous milestones

**Only after the gate is green do you move to the next milestone.**

### 8. Commit

After the gate is green, commit all files created or modified during the milestone:

- **Commit message format:** `<type>(<scope>): <description>` — e.g. `feat(auth): add register, login, refresh, logout endpoints`
- **No co-authored-by lines** — commit with the user's author only
- **Scope:** the module or area (auth, tags, events, rsvps, shared, config, etc.)
- **Type:** feat, fix, test, refactor, docs, chore
- **Only commit milestone files** — do not include unrelated changes
- **Verify after commit:** `git status` clean, `git log --oneline -1` shows the new commit

```bash
git add <milestone-files>
git commit -m "feat(auth): add register, login, refresh, logout endpoints"
```

---

## Frontend Phase — Screenshot Comparison Workflow (M0008 ONLY)

> **CRITICAL:** This workflow applies ONLY to M0008 (UI Parity & Docs). All other milestones use the standard cycle above.

**Reference design location:** `E:\Leapfrog\docs-exp\Final-Design`

### Why This Exists

No matter how good the implementation, there will always be mismatches — font differences, text sizes, spacing, colors, alignment. The screenshot-comparison workflow catches these visually and fixes them iteratively.

### Per-Page Workflow (STRICT — one page at a time)

```
1. ANALYZE  — Read the design HTML for this page
2. DEVELOP  — Build the React page/components
3. SCREENSHOT DESIGN   — Screenshot the original HTML (Playwright MCP)
4. SCREENSHOT REACT    — Screenshot the React implementation
5. COMPARE  — Side-by-side visual comparison
6. ANALYZE  — List every regression/mismatch (font, size, spacing, color, alignment, content)
7. FIX PLAN — Document what needs to change
8. FIX      — Apply fixes
9. RETEST   — Screenshot both again, compare again
10. REPEAT until 100% match
11. ONLY THEN move to next page
```

### Why One Page at a Time

- Large todo lists (all pages) degrade work quality
- Each page needs focused attention to match pixel-perfectly
- Regressions from earlier pages must not be reintroduced

### Screenshot Storage

```
docs-exp/0008-milestone-ui-parity/
├── screenshots/
│   ├── design/
│   │   ├── login.html.png
│   │   ├── dashboard.html.png
│   │   └── ...
│   ├── react/
│   │   ├── login.png
│   │   ├── dashboard.png
│   │   └── ...
│   └── comparisons/
│       ├── login-comparison.png
│       └── ...
```

### Tool

- **Playwright MCP** for screenshots (both design HTML and React app)
- Design files served locally (e.g., `file://` or local server)
- React app running on dev server

---

## Code Quality Standards

### Before Every Commit

Run all three checks — no exceptions:

```bash
npm run typecheck   # no errors
npm run lint        # no errors
npm run test        # all tests green
```

### Type Safety

- **No `as unknown as` casts** — use Zod validation at the edge instead
- **No `req.user!.id`** — use a guard (`if (!req.user) throw ...`) or typed request interface
- **Prefer `unknown` over `any`** — if you must use `any`, justify it in a comment
- **Type exports** — Zod schemas should be typed as `ValidationSchemas`

### Error Handling

- **Controllers: never try-catch** — throw domain errors, let middleware handle
- **Services: throw domain errors** (NotFoundError, ConflictError, etc.)
- **Middleware: only catch expected errors** — log unexpected ones, pass as 500
- **Error handler: only trust `.statusCode` from `AppError`** — never from unknown thrown objects

### Test Conventions

- **Extract shared helpers** to `tests/helpers/` — never duplicate `createTestUser`, `resetTestData`, `createInMemoryCache`, or `testConfig`
- **Use bcrypt cost 4-6** in tests (not 12 — too slow)
- **Follow AAA pattern** (Arrange-Act-Assert)
- **No `console.log` in tests** — use assertions
- **One test file per endpoint** — `describe('POST /api/auth/login')` maps to the route

### Architecture Rules

- **No try-catch in controllers** (error flow: throw → middleware → envelope)
- **Validate at the edge** (Zod schemas co-located with routes, before business logic)
- **Follow existing patterns** (check `src/shared/` for conventions)
- **Module composition** — wire dependencies in `module.ts`, not in controllers or services

---

## Context Window Management

When the conversation approaches **400k tokens**, compact the conversation before continuing. This means summarizing the current state (what's built, what's next, any open issues) and starting fresh with the compacted context.

---

## Testing Hierarchy

| Phase         | Tool                     | Purpose                                              |
| ------------- | ------------------------ | ---------------------------------------------------- |
| Unit          | vitest                   | Domain logic, adapters, middleware, permissions      |
| Contract      | vitest + supertest       | HTTP endpoints, envelope, error shapes, status codes |
| Parity        | vitest + Redis opt-in    | Cache adapter interchangeability                     |
| E2E (pre-UI)  | curl / supertest scripts | Smoke tests against running app                      |
| E2E (post-UI) | Playwright MCP           | Full UI flows against real backend                   |

---

## Branch Strategy

Handled externally. This workflow defines the content of work, not the git mechanics.

---

## Milestone Map

| #    | Name               | Phases  | Content                                 |
| ---- | ------------------ | ------- | --------------------------------------- |
| 0001 | Foundation         | P0–P1   | Scaffold + shared kernel ✅             |
| 0002 | Data Layer         | P2      | Knex, migrations, seeds, dev Compose ✅ |
| 0003 | Auth Module        | P3–P4   | Auth, users, permissions, guards        |
| 0004 | Tags Module        | P5      | Tag CRUD                                |
| 0005 | Events Module      | P6      | Events, lifecycle, filters, ports       |
| 0006 | RSVPs Module       | P7      | RSVPs, capacity, enrichment             |
| 0007 | Hardening & Docker | P8–P9   | Platform middleware, OpenAPI, image     |
| 0008 | UI Parity & Docs   | P10–P11 | Playwright parity, final documentation  |
