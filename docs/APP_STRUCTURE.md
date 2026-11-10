# PubliPulse application structure

PubliPulse is organized as an npm workspaces monorepo with a clear split between **backend**, **web command center**, and **field app**.

```
PubliPulse/
├── apps/
│   ├── api/          # Fastify + Postgres API (source of truth, audit, governance)
│   ├── web/          # District / surveillance command-center (desktop browser)
│   └── field/        # Field worker app (mobile-first PWA, offline-first)
├── packages/
│   └── shared/       # Domain schemas, contracts, offline replay helpers (Zod)
├── docs/             # Product, security, pilot, and phase documentation
└── scripts/          # Release gates, migration checks, contract tests
```

## Roles of each app

| App | Audience | Connectivity assumption | Primary jobs |
|-----|----------|-------------------------|--------------|
| **api** | All clients | Always online (server) | Auth, tenant scope, signals, investigations, decisions, actions, outcomes, audit, interoperability boundaries |
| **web** | District surveillance desk, programme managers, weekly reviewers | Reliable office/network connectivity | Case workflow overview, action-gap review, outcome intelligence, weekly decision agenda, connected API workflows |
| **field** | Community health workers, facility responders, field investigators | Intermittent / offline-first | Signal capture, local queue, action/outcome mutation queue, explicit sync when a short-lived session token is available |

## Design boundaries

### Shared package (`@publipulse/shared`)

- Zod schemas for signals, outcomes, offline mutations, interoperability contracts, learning, etc.
- Pure domain helpers (e.g. offline replay classification).
- No React, no IndexedDB, no Fastify — usable from API and any future client.

### Web (`@publipulse/web`)

- React + Vite desktop-oriented UI.
- Rich panels for evaluation, weekly review, outcome intelligence, and demo/connected workflows.
- May embed a light field prototype for demos; production field use is intended via **apps/field**.

### Web source layout (`apps/web/src`)

```
main.tsx              # entry only: mounts <App />
App.tsx               # command-center UI and state
action-gap-engine.js  # pure gap evaluation (+ .d.ts)
lib/types.ts          # shared web types
lib/demo-cases.ts     # synthetic demo cases and fixed clock
lib/format.ts         # display helpers
lib/field-queue.ts    # IndexedDB queue for the embedded field prototype (no tokens stored)
```

Source-contract tests read the whole folder through `scripts/lib/web-source.mjs`, so files can be split further without editing each test.

### Field (`@publipulse/field`)

- React + Vite **PWA** (installable, portrait, safe-area aware).
- Device queue in **IndexedDB only** for signals and offline mutations.
- **Access tokens are never written** to IndexedDB, localStorage, or sessionStorage — session token is memory-only.
- Sync is explicit and idempotent: signals use `clientSubmissionId` plus an `Idempotency-Key` header; outcome assessments use an `x-client-mutation-id` header. Every request also carries `x-organization-id`.
- The field **Update** tab creates action updates and outcome assessments offline; `apps/field/src/mutation-builders.ts` validates them against the same rules as the API before they are queued. The queue shows per-item conflict, rejected and retry states after each sync.
- Conflicts (HTTP 409) and retryable failures stay visible in the queue.

### API (`@publipulse/api`)

- Single backend for both web and field.
- Field clients use the same `/v1/signals`, action, and outcome endpoints with idempotency and version conflict handling.

## Development

```bash
# All three: API + web + field
npm run dev

# API + web only
npm run dev:web

# API + field only
npm run dev:field
```

| App   | Default URL              |
|-------|--------------------------|
| API   | http://127.0.0.1:4000    |
| Web   | Vite default (5173)      |
| Field | http://127.0.0.1:5174    |

Field Vite proxies `/v1` → API during local development.

## Build

```bash
npm run build          # shared → api → web → field
npm run build:web      # shared → api → web
npm run build:field    # shared → field
```

## Security notes (field)

1. No credentials or refresh tokens on the device queue.
2. No direct patient identifiers in queued payloads.
3. Managed-device policy (not IndexedDB alone) is required for lost-device scenarios.
4. See `docs/FIELD_OFFLINE_PILOT.md` and `docs/PHASE_4_FIELD_OPERATIONS.md`.

## Evolution path

- **Near term:** keep field as a PWA for low-friction pilot deployment.
- **Later:** if native packaging is required (push, stronger device binding), the same React tree can be wrapped with Capacitor/React Native while continuing to share `@publipulse/shared` contracts with the API.
