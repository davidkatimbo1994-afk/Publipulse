# Phase 4 — Field Operations

PubliPulse now has a field-capture mode designed for intermittent connectivity and African operational environments.

## Design
- Signal intake uses the existing `SignalIntakeSchema` and an idempotent `clientSubmissionId`.
- When offline, observations are stored in browser IndexedDB as a device queue.
- Access tokens are never stored in IndexedDB, localStorage, or sessionStorage.
- When connectivity, an organization ID (sent as `x-organization-id`) and an in-memory authorization token are available, queued observations can be synchronized through `POST /v1/signals` with an `Idempotency-Key` header.
- Category, source and location-precision options mirror `SignalIntakeSchema`; the API rejects any other value.
- Field workers can queue action updates (status, due date, completion evidence, with the version they last saw) and outcome assessments while offline. Version conflicts and server rejections stay visible in the queue and are never overwritten or deleted silently.
- Failed submissions remain queued rather than being discarded.
- Intake explicitly excludes direct patient identifiers.
- Language selection currently changes the field-workflow preference only; terminology must be locally validated before operational translation claims are made.

## Governance boundary
This is an operational prototype, not authorization to collect sensitive health data. Production deployment still requires approved privacy, retention, lawful-basis, security, offline-device and data-governance controls.
