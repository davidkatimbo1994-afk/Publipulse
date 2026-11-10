# @publipulse/field

Mobile-first **field worker app** for PubliPulse.

## Purpose

Offline-first capture of public health **signals**, with a device queue for signals and workflow mutations (action updates / outcome assessments). Designed for intermittent connectivity and African operational environments.

## Security constraints

- Access tokens are **never** stored in IndexedDB, localStorage, or sessionStorage.
- Queued payloads must not include direct patient identifiers.
- Sync is explicit; HTTP 409 conflicts remain visible in the queue.
- See `docs/FIELD_OFFLINE_PILOT.md`.

## Run

From the monorepo root:

```bash
npm install
npm run dev:field
```

- Field UI: http://127.0.0.1:5174  
- API (proxied `/v1`): http://127.0.0.1:4000  

## Syncing

Sync needs three things, entered on the **Sync** tab and kept in memory only:

1. API base URL (leave blank in dev; Vite proxies `/v1` to the API on port 4000).
2. **Organization ID** (UUID). Sent as `x-organization-id` on every request; the API rejects requests without it.
3. A short-lived access token.

Signal options (category, source, precision) mirror `SignalIntakeSchema` in `packages/shared/src/signal.ts`; `scripts/check-field-api-contract.test.mjs` fails if they drift.

Queued outcome assessments replay to `POST /v1/signals/:signalId/outcomes` with an `x-client-mutation-id` header; action updates replay to `PATCH /v1/actions/:actionId`. The **Update** tab creates both kinds of mutation offline. Its checks mirror the API's strict schemas (`apps/field/src/mutation-builders.ts`), so a mutation that could never be accepted is refused on the device. After a sync attempt the queue marks each item `conflict` (version changed on the server), `rejected` (the server refused it) or `retry` (network or server error); nothing is deleted silently.

## Install as PWA

Build and serve over HTTPS (or localhost). The Vite PWA plugin registers a service worker for the app shell only — operational API data is not cached offline by the SW; the IndexedDB queue is the source of offline durability.
