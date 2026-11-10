# PubliPulse — Secure Public Health Action Platform

> Sections below the current baseline are a historical record of earlier increments. Statements such as "lockfile missing" in them were true at that version and are kept for traceability; the current status is the table directly below and `CHANGELOG.md`. API endpoints: `docs/API_REFERENCE.md`.


## Application layout (web + field)

PubliPulse is a monorepo with three apps and one shared domain package:

| Path | Package | Role |
|------|---------|------|
| `apps/api` | `@publipulse/api` | Backend API (Fastify + Postgres) |
| `apps/web` | `@publipulse/web` | **Web** command center (district / surveillance desk) |
| `apps/field` | `@publipulse/field` | **Field** app (mobile-first PWA, offline queue) |
| `packages/shared` | `@publipulse/shared` | Domain schemas & contracts |

See **[docs/APP_STRUCTURE.md](docs/APP_STRUCTURE.md)** for responsibilities, security boundaries, and how to run web vs field.

```bash
npm run dev          # API + web + field
npm run dev:web      # API + web only
npm run dev:field    # API + field only
```


## Current baseline — v1.19.1 + correctness fixes (see CHANGELOG "Unreleased")

### Verification status (read this first)
| Area | Status |
|---|---|
| Outcome recording (the product's core path) | Fixed: the insert had 18 columns but 17 placeholders and would have failed on every call. Now covered by a constraint-aware store test. |
| SQL statements in `apps/api/src` | `npm run check:sql` verifies arity and checks every INSERT/UPDATE against the migrated schema. Runs in CI. |
| Real PostgreSQL end-to-end run | **Not yet done.** Run `npm run test:db` against a throwaway Postgres before any pilot. |
| Real identity provider / DHIS2 connection | **Not yet done.** Contract tests and a test double only. |
| `package-lock.json` | Committed (lockfile v3) but **does not yet include the `apps/field` workspace**, so `node scripts/verify-lockfile.mjs`, `npm run check:release-readiness` and `npm ci` fail until it is regenerated (`npm run lockfile:refresh` on a networked machine, or the "Lockfile bootstrap" workflow); the script also rewrites `package-lock.sha256`. A clean `npm ci` + typecheck + test + build run is still required evidence before release. |
| Web and field typecheck/build | **Not yet run in this environment** (dependencies could not be installed). Run `npm run typecheck && npm run build` after `npm install`. |
| Field app ↔ API contract | Fixed: field intake options now match `SignalIntakeSchema`, requests send `x-organization-id`, outcomes post to `/v1/signals/:signalId/outcomes` with `x-client-mutation-id`, and client ids are always UUIDs. Guarded by `scripts/check-field-api-contract.test.mjs`. The field UI can now create, queue and replay action updates and outcome assessments (validated on the device against the same rules as the API), and the queue shows conflicts and server rejections per item. |
| Many `scripts/check-*.test.mjs` files | Static text checks: they prove code was written, not that it behaves. Behavioural tests live in `apps/*/test` and `packages/*/test`. |


Controlled DHIS2 pilot transport readiness is implemented; live external connectivity remains a deployment evidence gate.

### v1.7.0 — Outcome-first operational intelligence

PubliPulse now exposes a descriptive response-effectiveness decay view across signal, verification, ownership, action, outcome measurement, and durable follow-up. It also normalizes response blockers and adds append-only foundations for reporter feedback and persistent-problem learning decisions. These controls are operational learning signals, not clinical or causal effectiveness claims.


This release centralizes strict decimal pagination validation across API list endpoints, adds response request IDs for operational correlation, and preserves the fail-closed production posture. The underlying v1.6.0 database and interoperability hardening remains in effect.

Production use still requires the external release gates in `docs/RELEASE_GATES.md`: a committed lockfile, clean dependency-backed CI, real PostgreSQL/RLS execution, real OIDC staging verification, deployment/TLS/secrets/backup controls, privacy and retention approval, security assessment, and public-health governance approval. This build does not claim those external gates have already passed.


## v1.4.0 — Outcome Intelligence workspace

The web preview now surfaces outcome-first review candidates: cases closed without demonstrated resolution, recurring concerns, persistent-pattern candidates, and items warranting expert review. These are deterministic workflow signals and do not establish causation or clinical effectiveness.
## v1.5.0 — Phase 7 interoperability groundwork completed

Phase 7 now provides the provider-neutral groundwork for future DHIS2/FHIR-style exchange across African country and programme configurations. It includes standardized indicators, versioned country and administrative-unit mappings, explicit sharing boundaries, integration profiles, exchange contracts, idempotent job state, append-only provenance, reconciliation, DHIS2 metadata drift detection, a controlled in-memory DHIS2 harness, a provider-neutral exchange envelope, and deterministic offline CSV support.

**No live external transfer is claimed or enabled in this release.** Credentials remain outside PubliPulse persistence. The controlled harness performs no network I/O. External transfer remains fail-closed until a verified provider adapter and production release gates are explicitly enabled.

## v1.3.1 — Outcome Effectiveness Integrity Polish

This polish release hardens outcome-effectiveness integrity and persistent-problem assessment bounds while preserving append-only evidence and the outcome-first architecture.

### Integrity fixes
- Persisted unresolved and recurrence counts cannot exceed the occurrence count.
- Persistent-problem classification rejects invalid negative, fractional, or inconsistent counters.
- Migration 023 adds the new database constraints without rewriting migration 022.
- Migration sequence and checksum verification cover all 23 migrations (23 at this release; 36 at v1.19.1).

## v1.3.0 — Outcome Effectiveness & Persistent-Problem Learning

PubliPulse prioritizes outcome integrity: administrative closure is not treated as proof of resolution. This increment adds bounded learning synthesis across intervention evaluations and persistent-problem assessments. It can identify when repeated problems continue despite previous action and when multiple interventions have been tried without durable improvement. These classifications are review prompts and operational-learning evidence, not causal inference or clinical-effectiveness claims.

### Core learning distinctions
- `supported`: sufficient observed evaluations consistently show improvement without recorded recurrence.
- `mixed`: improvement exists, but recurrence or conflicting outcomes limits confidence.
- `not_supported`: sufficient-evidence evaluations do not support retaining the intervention as effective in the evaluated context.
- `insufficient_evidence`: evidence is too limited or inconclusive for a reliable learning classification.
- `intervention_resistant`: a persistent pattern has recurred after multiple distinct interventions; this is a prioritization signal, not proof that an intervention cannot work.


## v0.95.0 — Phase 7C: External interoperability exchange boundary

This increment adds a controlled exchange boundary for future DHIS2/FHIR/other adapters. It introduces a versioned interoperability contract, provider capability checks, country indicator mapping-version checks, idempotent exchange-job state, exchange receipts, tenant-scoped RLS, and an explicit disabled-transport posture.

**No live DHIS2 connection is claimed.** The exchange endpoint validates and records a request but deliberately rejects it when no verified provider transport is enabled. Credentials, access tokens, client secrets, and refresh tokens remain outside the database.

The intended production sequence is: contract validation → tenant/policy checks → verified integration profile → provider adapter → external request → provider receipt → immutable audit evidence.

### Phase 7C boundary

- `InteroperabilityContractSchema` is versioned at `1.0`.
- `POST /v1/interoperability/exchange-requests` requires `Idempotency-Key`.
- A verified integration profile and required capability are mandatory.
- Indicator mappings and their declared mapping version must exist for the requested country.
- Cross-border exchange requires an explicit sharing-policy permission.
- Every request is tenant-scoped and persisted with a contract fingerprint.
- A request that passes policy validation is still rejected with `transport_disabled` until a controlled adapter is explicitly enabled.
- Exchange receipts expose provider status/reference information only; they never contain credentials.

### DHIS2 readiness status

`DHIS2 metadata model: contract-ready`

`DHIS2 authentication: abstraction only`

`DHIS2 HTTP connectivity: NOT IMPLEMENTED / NOT VERIFIED`

`DHIS2 org-unit synchronization: model boundary only`

`DHIS2 credential handling: runtime provider abstraction only; no credentials persisted`

`Exchange retries: exponential-backoff state model present; execution disabled until adapter verification`

`DHIS2 indicator exchange: contract boundary only`

## v0.94.0 — Phase 7: African-scale interoperability & governance architecture

This increment establishes the metadata and enforcement foundations for country-aware, programme-aware and indicator-standardized interoperability. It adds country configuration, programme configuration, an indicator registry with country mappings, explicit tenant-scoped data-sharing policies, and integration profiles that can represent a planned/configured/verification-pending/verified state.

DHIS2, FHIR and other providers are represented as interoperability targets only. **No live external-system integration is claimed or implied by this release.** Integration profiles contain metadata and never store credentials or tokens. Sharing policies are explicit boundaries, but a policy alone does not authorize an external transfer; every future exchange adapter must enforce the policy, tenant scope, minimum-cell suppression and audit requirements at the transfer boundary.

The architecture is intentionally African-scale: a single organization can operate programmes in multiple countries, while country-specific administrative levels and indicator mappings remain configurable. The initial deployment context may validate the model in one country without turning the product into a country-specific design.

**Phase 7 status:** architecture and database/API foundations implemented; live DHIS2/FHIR connectivity, external partner authorization, country-by-country indicator validation, legal/privacy review, and production data-sharing approvals remain unverified release gates.

## v0.90.0 — Signal-to-Outcome workflow

This increment moves the product beyond the Action Gap prototype into a visible Signal → Investigation → Decision → Response → Outcome workflow. The web experience now includes a connected workspace for authorized inspection of tenant-scoped signals, evidence, investigations, decisions, actions, outcomes, action gaps and action-handoff events. Outcome assessments remain explicitly separate from task completion, with baseline/target/follow-up measurements and uncertainty preserved. Demo data remains synthetic and session-only.

The connected workspace uses the existing authenticated API contracts; credentials are kept in page memory only. Action handoffs are recorded through the existing audited handoff API. This increment does not claim production readiness: the committed package lockfile, live PostgreSQL/RLS execution, OIDC end-to-end verification, deployment, privacy and public-health governance gates remain outstanding.

## v0.61.0 — Outcome evidence and accountability

This increment strengthens outcome accountability without treating a completed response task as proof of public-health impact. The database migration adds optional target, result, evidence-source, uncertainty, and assessment-method fields to existing outcome records, with validation constraints and indexes. The shared `OutcomeAssessmentSchema` defines a strict assessment contract: indicator, result, evidence summary, assessment timestamp, optional baseline/target/follow-up measurements, and explicit uncertainty when a result is inconclusive. Corrections should preserve the audit trail rather than silently rewrite historical assessments.

The API now exposes authenticated `POST /v1/signals/:signalId/outcomes` and `GET /v1/signals/:signalId/outcomes` endpoints backed by PostgreSQL. Creating an assessment requires an active signal and an action belonging to that same signal and organization; writes are audit-logged and connected to the action graph. Reads and writes are organization-scoped. The UI does not yet provide a complete outcome-assessment workflow. Release preflight remains blocked until the dependency lockfile is generated, reviewed, and committed. Static checks do not establish live PostgreSQL/RLS, deployment, privacy, or public-health governance readiness.

## v0.60.0 — Workflow traceability prototype

This release adds a session-only workflow activity timeline to demonstrate traceability and separates response-task completion from outcome verification. The preview uses synthetic data only; timeline entries are not persisted or an authoritative audit log.

## v0.59.0 — Action Gap Engine prototype

PubliPulse is being developed as an evidence-linked public-health action and outcome-learning network. Its signature workflow goal is to expose where response stalls between signal, verification, accountable ownership, action, and outcome assessment. The current web preview includes a deterministic rule-based Action Gap Engine that flags missing owners, overdue steps, declared blockers, recurring concerns, limited/conflicting evidence, and completed work without outcome evidence. Each flag includes an explanation and a suggested next step for authorized human review.

The current demo data is synthetic, browser-local actions are not persisted, and the rules are a prototype rather than a validated public-health risk model. Do not use this build for real health data or operational decisions. The differentiator is a hypothesis to validate against existing surveillance and response systems—not a claim that no other product offers similar capabilities.

### v0.56.0 change
The disposable PostgreSQL CI job now validates migration numbering, explicit transaction wrappers, and destructive-DDL review guardrails before applying SQL. It then verifies the committed SHA-256 manifest before any database changes. This catches migration sequence drift and accidental or unreviewed edits to existing migration files; it does not replace database integration testing. New migrations must be added as new numbered files and the checksum manifest deliberately regenerated.

**Status:** v0.56.0 engineering increment / MVP foundation, not production-ready. The committed npm lockfile is still missing; full dependency-backed install/typecheck/build/audit, live PostgreSQL/RLS execution, OIDC integration, and governance sign-off remain release blockers. Synthetic data only.

### v0.54.0 change
A new lockfile consistency verifier checks npm lockfile v3 against the root and all declared workspace manifests, including workspace package names, versions, and declared dependency sections. Bootstrap and normal CI now run this check to catch stale lockfiles before dependency installation and release validation. The actual lockfile remains missing in this environment; this increment does not claim a successful networked install or production build.

### v0.53.0 change
The manually triggered lockfile bootstrap now publishes a SHA-256 checksum alongside the generated `package-lock.json`, verifies the checksum before clean installation, and has bounded job timeouts and concurrency control. This improves artifact handling but does not mean the lockfile has been generated locally or committed; the workflow and full release checks must still run on GitHub.

### v0.52.0 change
A manually triggered GitHub Actions workflow now bootstraps a real workspace `package-lock.json` on a networked runner, publishes it as a seven-day artifact, and validates that artifact through a clean `npm ci`, tests, typecheck, build, and production dependency audit. The artifact must still be reviewed and committed; ordinary CI continues to block a missing committed lockfile. This local environment has not generated or verified a lockfile.

### v0.51.0 change
Audit route runtime regression tests now exercise the actual TypeScript route handler with a controlled fake app and store. Coverage includes authentication, audit-reader authorization, invalid and ambiguous limits, default/maximum pagination, cursor validation and propagation, next-cursor output, and storage-error propagation. These are handler-level tests, not full HTTP/server integration tests.

### v0.50.0 change
The membership-role constraint and OIDC role allowlist now agree on the dedicated `auditor` role, so audit-reader authorization can be assigned through a valid active organization membership. Migration `010_auditor_membership_role.sql` only adds the role label; database grants and RLS remain separate controls.

Audit integrity posture verification is available in `apps/api/test/sql/verify_audit_integrity_posture.sql`; it checks configured database safeguards, not cryptographic authenticity or completeness.
- Audit pagination cursors now require canonical base64url, an exact allowlisted payload shape, a valid normalized ISO timestamp, and an ID within PostgreSQL's signed-bigint range. Invalid cursors are rejected before database access.
- Runtime cursor regression tests cover valid round trips and malformed, oversized, ambiguous, extra-field, invalid-date, and out-of-range payloads.

- API list page-size query parameters use shared strict canonical decimal validation and reject repeated/ambiguous values rather than relying on JavaScript coercion.
- API readiness now requires the audit store to be configured and reports its status explicitly.

**Status:** v0.55.0 engineering increment / MVP foundation, not production-ready. Uses synthetic data only until security, privacy, operational and public-health governance gates pass. Full dependency-backed CI/build and live PostgreSQL/RLS/OIDC verification remain release gates; `package-lock.json` is missing.


### v0.42.0 change
- Investigation and response-action update audit records now include the prior version and resulting version for reconciliation with optimistic concurrency checks.
- Added source-level regression tests for version attribution and transactional ordering. Live PostgreSQL/RLS, OIDC, dependency-backed CI, and production build remain release gates.

**Status:** v0.42.0 engineering increment / MVP foundation, not production-ready. Uses synthetic data only until security, privacy, operational and public-health governance gates pass.

### v0.41.0 change
- Added regression checks for audit metadata minimization across signal, evidence, investigation, decision, and response-action persistence code. Tests reject raw narrative/source/credential fields in audit metadata and verify transactional audit ordering.
- These are source-level guardrails, not proof of deployed behavior; full dependency-backed CI, live PostgreSQL/RLS, OIDC, and production build remain release gates.

**Status:** v0.41.0 engineering increment / MVP foundation, not production-ready. Uses synthetic data only until security, privacy, operational and public-health governance gates pass.

### v0.40.0 change
- Response-action status changes now follow an explicit transition policy; skipped, reversed, and terminal-state changes are rejected as conflicts.
- Same-state edits remain allowed, and completion evidence remains required before completion.
- Dependency-free regression checks cover transition policy. Full dependency-backed CI, live PostgreSQL/RLS and OIDC verification remain release gates.

**Status:** v0.40.0 engineering increment / MVP foundation, not production-ready. Uses synthetic data only until security, privacy, operational and public-health governance gates pass.

### v0.39.0 change
- Added a statement-level PostgreSQL trigger that rejects `TRUNCATE` on `audit_events`, closing the gap left by row-level UPDATE/DELETE triggers.
- Reuses the existing audit mutation rejection function; database runtime roles must still lack TRUNCATE and DDL privileges.
- Static regression checks do not replace live PostgreSQL integration testing. This is not production-ready.

### v0.37.0 change
- Added a database trigger requiring operational Action Graph edges to connect nodes from the same signal; `related_to` remains the explicit cross-signal relation.
- Added regression checks for all six node types and existing decision/action edge shapes. Live PostgreSQL execution is still required.


**Status:** v0.37.0 engineering increment / MVP foundation, not production-ready. Uses synthetic data only until security, privacy, operational and clinical governance gates pass.

### v0.36.0 change
- Production `DATABASE_URL` validation rejects `ssl` and PostgreSQL `options` parameters, keeping transport and session policy under service configuration.
- Added regression coverage for case variants, encoded parameter names, and session-option overrides.

### v0.35.0 change
- Production database URL validation rejects TLS override parameter names case-insensitively, including percent-encoded names and parameters combined with other query settings.
- Regression coverage checks uppercase, mixed-case, encoded, and combined TLS override attempts.
- Full dependency-backed CI, live PostgreSQL/RLS tests, and OIDC integration remain unverified; this is not production-ready.

### v0.32.0 change
- Production database URLs must explicitly name a host and database, and must not contain URL fragments.
- OIDC issuer URLs must not contain query strings or fragments; HTTPS and no embedded credentials remain required.
- Added dependency-free regression checks for malformed-but-parseable connection URLs and invalid issuer URI components.
- These source-level checks do not replace full dependency-backed CI or live PostgreSQL/OIDC verification.

### v0.34.0 change
- Production `DATABASE_URL` now rejects SSL-related query parameters (`sslmode`, `sslcert`, `sslkey`, `sslrootcert`) that could override the PostgreSQL pool's explicit certificate-verifying TLS configuration.
- Regression coverage includes insecure and alternate SSL URL overrides; this is configuration hardening only.
- Full dependency-backed CI, live PostgreSQL/RLS tests, and OIDC integration remain unverified; this is not production-ready.

### v0.33.0 change
- `API_PORT` now uses strict decimal TCP-port parsing, defaults to `4000`, and rejects malformed numeric forms that JavaScript's generic number conversion would otherwise accept.
- Added dependency-free regression checks for valid ports, boundary values, malformed inputs, and server wiring.
- Full dependency-backed CI, live PostgreSQL/RLS tests, and OIDC integration remain unverified; this is not production-ready.


- Production database URLs must explicitly name a host and database, and must not contain URL fragments.
- OIDC issuer URLs must not contain query strings or fragments; HTTPS and no embedded credentials remain required.
- Added dependency-free regression checks for malformed-but-parseable connection URLs and invalid issuer URI components.
- These source-level checks do not replace full dependency-backed CI or live PostgreSQL/OIDC verification.

Production startup now validates required database/OIDC settings before allocating the PostgreSQL pool. It rejects blank required values, non-PostgreSQL database URL schemes, and non-HTTPS or credential-bearing OIDC issuer/JWKS URLs. These are preflight checks and do not replace integration tests against real services.

### v0.30.0 change
Production startup now validates `WEB_ORIGIN` before allocating the PostgreSQL pool, preventing a missing or invalid production origin from causing unnecessary database resource allocation. Production requires an explicit HTTPS origin without a path.

### v0.29.0 change
The PostgreSQL pool now applies five-second connection, client-query, and server-side statement timeouts to reduce the risk of stalled queries holding connections indefinitely. Static regression coverage checks that these limits remain configured.

### v0.28.0 change
The PostgreSQL readiness probe now preserves a failed connectivity query if client release also fails, while still surfacing release failures after a successful query. The behaviour has executable mock-client regression tests.

## Product workflow
Signal → Evidence → Investigation → Decision → Action → Outcome.

## Architecture
- `apps/api`: TypeScript API service with security middleware and versioned health endpoints.
- `apps/web`: responsive React + TypeScript interface starter.
- `packages/shared`: shared validation contracts.
- `docs`: threat model, architecture decisions, data governance, release gates.

Initial deployment shape is a modular monolith. PostgreSQL is the system of record; use tenant-scoped queries and database-enforced row security before storing real organisational data. Do not add microservices or a graph database until measured needs justify them.

## Local development
Requires Node.js 22+ and npm. From the repository root:

```sh
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

Use `npm ci` (not `npm install`) for reproducible installs from the committed lockfile; regenerate it only on a supported, networked npm environment and re-run `node scripts/verify-lockfile.mjs`. Never deploy based only on a successful local development server.

## Security note
The API server can wire OIDC verification and PostgreSQL adapters when `DATABASE_URL`, `OIDC_ISSUER`, `OIDC_AUDIENCE`, and `OIDC_JWKS_URL` are configured; production startup fails closed if required settings are missing. Routes fail closed when their identity or persistence adapters are absent. The PostgreSQL adapters use transaction-local tenant scope and transactional audit events. However, full typechecking, test execution, production build, dependency audit, and live PostgreSQL verification have not been completed in this environment. Do not put real health or personally identifiable data into it.

## v0.15.0 — Migration-validator hardening

- Improved SQL inspection so comments and single-quoted string literals do not trigger false destructive-DDL warnings; quoted identifiers remain detectable.
- Tightened transaction checks to reject executable SQL after the final `COMMIT`.
- Added three regression tests, bringing migration-tool tests to eight; all eight passed locally and all six migrations passed the checker.
- This is a lightweight guardrail, not a full PostgreSQL parser. Full application CI, lockfile, and actual PostgreSQL execution remain release blockers.


## v0.16.0 — Tenant-scope and audit-trigger regression coverage

- Added a regression assertion that row-level security returns no signal rows when tenant scope is not set.
- Added a deliberately over-privileged test role to prove audit mutation triggers still reject updates/deletes as defence in depth.
- PostgreSQL execution, clean install, full tests/build and dependency audit remain unverified; the npm lockfile is still a release blocker.


## v0.12.0 — Repeatable database regression checks

- Fixed the PostgreSQL integration script so its append-only audit test no longer attempts to delete the seed audit row after the test transaction; that cleanup conflicted with the very trigger being tested.
- Made audit and graph-edge fixtures idempotent across repeated CI runs.
- Added regression checks for moving a graph-referenced node between tenants and updating a graph edge to a missing endpoint.
- This corrects test-harness logic but does not count as a successful PostgreSQL run. PostgreSQL is unavailable in this environment, and the dependency lockfile, clean install, typecheck, unit tests, production build, and dependency audit remain release blockers.

## v0.11.0 — Graph node lifecycle integrity

- Added migration `006_graph_node_lifecycle_integrity.sql` to prevent deletion or tenant/ID moves of nodes already referenced by the polymorphic Action Graph.
- Updated graph-edge endpoint validation to acquire key-share locks, reducing the race between checking an endpoint and concurrent deletion/key changes.
- Expanded disposable PostgreSQL integration checks for valid edges, missing/cross-tenant endpoints, and deletion protection for referenced outcomes.
- This is a source-level increment only. The lockfile and successful clean CI execution remain release blockers; continue using synthetic data only.

## v0.2.0 engineering increment

- Added `apps/api/migrations/001_initial_action_graph.sql` for the initial relational Action Graph: signals, evidence, investigations, decisions, response actions, outcomes, graph edges, memberships and audit events.
- Added tenant-scoped PostgreSQL row-level security policies and an append-only audit mutation trigger as defence-in-depth.
- Added Action Graph invariants and secure-development guidance.
- Expanded release gates for identity, privacy, offline sync, operations and public-health governance.

**Important:** the migration has not been applied to a live PostgreSQL instance and has not yet been validated with database integration tests. RLS depends on the API setting tenant scope from verified server-side membership inside a transaction. The migration intentionally does not grant runtime permissions. Do not use real health data.

The dependency lockfile remains outstanding. A lockfile-generation attempt timed out in this environment, so the package is not ready for `npm ci` or deployment. Generate the lockfile in a networked supported environment, then run and record all CI gates.

## v0.3.0 engineering increment

- Added versioned signal create/list routes with strict shared-schema validation.
- Routes require an injected verified-identity resolver and a persistence adapter; the default server returns `503` rather than pretending a service is configured.
- Added role checks, bounded list limits, generic error responses, and explicit idempotent replay versus changed-payload conflict semantics.
- Added a PostgreSQL adapter boundary that scopes each transaction to the verified organization, writes audit events in the same transaction, and releases connections in `finally`.
- Added tests for unconfigured fail-closed behaviour, unauthenticated requests, validation, role restrictions, retries and idempotency conflicts.
- Established a compiled package boundary for shared contracts to avoid importing source files across TypeScript package boundaries.

**Validation status:** changes have not yet been built or tested because dependency installation and lockfile generation timed out in this environment. The PostgreSQL migration and adapter also require integration tests against a disposable PostgreSQL instance before they can be treated as verified. The dependency lockfile remains a release blocker. No production readiness is claimed.


## v0.4.0 engineering increment

- Added OIDC access-token verification through a configured issuer, audience, and remote JWKS endpoint. Tokens are restricted to RS256/ES256; the issuer claim is matched exactly.
- Added active organisation-membership resolution from PostgreSQL. The `x-organization-id` header is only a tenant selector; membership must be confirmed server-side under transaction-local RLS scope.
- Added a PostgreSQL connection-pool adapter with bounded pool size, connection timeout, production TLS certificate verification, readiness query, and graceful shutdown.
- Wired the API server to the database and OIDC resolver only when all required settings exist. Production startup fails closed when required configuration is missing.
- Readiness now reports database and service configuration without exposing connection details.
- Added resolver tests for missing credentials, invalid tokens, tenant membership and unsupported roles.

**Validation status:** dependency installation and lockfile generation still time out in this environment. The new dependencies (`jose`, `pg`, `@types/pg`) have not been installed here; therefore compilation, tests, a live PostgreSQL integration, OIDC provider interoperability and TLS connectivity remain unverified. Before production use, generate and commit `package-lock.json`, run all CI checks, validate the migration and RLS using a non-owner database role, and verify token issuer/audience/JWKS settings against the chosen identity provider. Synthetic data only until these gates pass.

See `docs/DEPLOYMENT_SECURITY.md` for the OIDC configuration contract, minimum runtime database grants, and production verification gates.


## v0.5.0 engineering increment

- Added a PostgreSQL 16 CI service job that applies the initial migration to a disposable database and tests row-level tenant isolation with a non-owner runtime role.
- Added database assertions for cross-tenant reads, blocked cross-tenant writes, and append-only audit enforcement.
- Expanded adapter failure testing to assert that a failed audit write causes transaction rollback and connection release.
- Restricted GitHub Actions repository permissions to read-only and made the missing npm lockfile an explicit, understandable CI release blocker.

**Validation status:** the database integration test is now defined in CI but has not been executed in this environment because PostgreSQL/`psql` is unavailable. The repository still has no `package-lock.json`; therefore `npm ci`, full typechecking, unit tests, production build, and dependency audit remain unverified. Do not deploy or use real public-health data until the lockfile is generated and the complete CI suite passes.


## v0.6.0 engineering increment

- Added the first controlled signal lifecycle endpoint. Reviewers can move signals through defined states, while investigators have a narrower set of permitted transitions.
- Status changes require an expected version to prevent silent overwrites from concurrent reviewers. See `docs/SIGNAL_LIFECYCLE.md` for the transition matrix and role boundaries.
- PostgreSQL lifecycle changes and their audit events share a transaction; updates increment the version and record only the transition metadata, not free-text notes.
- The integration SQL now checks a same-tenant status update and version increment.

**Validation status:** the dependency lockfile is still absent because npm dependency resolution timed out in this environment. Full build, typecheck, unit tests and PostgreSQL CI remain unverified. The API remains an engineering starter, not a production-ready health system; synthetic data only.


## v0.8.0

Adds tenant-scoped investigation creation, listing and version-checked updates. Owner assignment must be an active member of the same organisation; investigators can update only their assigned investigations. Apply migration 002 after migration 001. See `docs/INVESTIGATION_WORKFLOW.md`. The dependency lockfile and full CI verification remain release blockers.

## v0.7.0 engineering increment

- Added evidence metadata endpoints: `POST /v1/signals/:signalId/evidence` and `GET /v1/signals/:signalId/evidence`.
- Evidence entries preserve source label, optional HTTPS reference, type, description, observation time and review status. Source URLs are stored only; the API does not fetch them.
- Evidence writes are tenant-scoped and audited transactionally. The API does not upload raw documents or accept direct patient identifiers in evidence metadata.

**Validation status:** dependencies and the npm lockfile are still outstanding. Full compilation, tests, production build and PostgreSQL integration have not been run here. Evidence metadata does not prove source authenticity or scientific validity. Synthetic data only until all security, privacy and public-health governance gates pass.


## v0.9.0 — Decisions and response actions

- Added audited decision records and assigned response-action endpoints to complete the initial signal → evidence → investigation → decision → action workflow.
- Added same-signal/tenant relationship checks, active organisation membership checks for assignees, version checks for updates, completion evidence requirements, and action-graph edges.
- Added migration `003_decision_action_versions.sql` and schema contract tests.
- The lockfile is still missing and full CI is not yet verified. Do not use real health data or treat this package as production-ready.


## v0.10.0 — Action Graph relationship integrity

- Added migration `004_graph_integrity.sql` to enforce that decisions reference investigations for the same signal, response actions reference decisions for the same signal, and outcomes reference actions for the same signal.
- Added migration `005_graph_edge_integrity.sql` to reject graph edges whose polymorphic endpoints do not exist in the same organisation.
- Extended the disposable PostgreSQL CI test with same-tenant cross-signal reference rejection checks and tenant visibility checks for decisions and response actions.
- These database constraints defend against invalid links even if a future API path or maintenance script bypasses application-level validation.

**Validation status:** SQL integration checks are defined but have not been executed in this environment. The npm lockfile remains missing; clean install, full typecheck, unit tests, build and dependency audit remain unverified. Continue using synthetic data only. This is not a production release.


## v0.13.0 engineering note

The repository now includes `npm run check:migrations`, a dependency-free static check for sequential migration filenames, explicit transaction boundaries, and destructive DDL review. PostgreSQL CI discovers and applies all migration files rather than duplicating the migration list in workflow YAML. This does not establish that the database suite passes; actual PostgreSQL execution remains a separate required release gate.


## v0.18.0 — Tenant policy completeness checks

- Added catalog-level PostgreSQL integration assertions that all ten tenant tables have row-level security enabled and forced.
- Added checks that the append-only audit trigger exists and is enabled, and that both integration roles are non-superuser, non-BYPASSRLS roles without database/role creation privileges.
- These assertions run in the configured PostgreSQL CI job; they have not been executed in this environment. The npm lockfile and full application CI remain release blockers.


## v0.63.0 — API-connected outcome assessment panel

The web preview includes a separate authorized API panel for loading and creating persisted outcome assessments. It accepts an API base URL, organization UUID, signal UUID, response-action UUID, and a bearer access token. Credentials are held in React page state only and are not written to local storage. Use HTTPS and an API CORS policy that explicitly permits the deployed web origin and the required headers. Synthetic dashboard case IDs remain demo-only and are never submitted to the API. A successful UI response does not replace deployment validation, PostgreSQL integration tests, or review of the organization role policy.

## Phase 7D — Interoperability provenance & reconciliation

Phase 7D adds an evidence layer around external exchange boundaries. It records source/mapping/transformation/submission/reconciliation provenance, makes exchange receipts append-only, and provides a conservative reconciliation model for comparing PubliPulse records and external results. Missing totals are never treated as zero; count drift remains a mismatch even when totals happen to agree.

This phase does **not** claim a live DHIS2 connection. `transport_verified` remains false until a controlled provider adapter produces a verified receipt.

## Phase 7E — Controlled DHIS2 Test Harness

PubliPulse v0.97.0 adds a deterministic, in-memory DHIS2-compatible test harness for proving the adapter contract before connecting to a real health-system instance. The harness accepts only controlled test bearer credentials, records submitted data value sets in memory, and cannot perform network I/O.

This release proves **adapter behavior**, not a live DHIS2 integration. Production exchange routes remain transport-disabled unless a verified provider adapter is explicitly wired into a controlled deployment.

## Phase 7F — DHIS2 Metadata Mapping & Reconciliation

PubliPulse now has a controlled, versioned mapping layer for DHIS2 metadata. Indicator and organisation-unit mappings are country-scoped and versioned. A deterministic reconciliation function compares an approved mapping set against a DHIS2 metadata snapshot and reports missing resources or attribute drift.

This phase still does **not** claim a live DHIS2 integration. Metadata reconciliation is evidence about a supplied snapshot; it is not evidence that a production DHIS2 server is reachable or that an exchange occurred.


## Phase 7G — Controlled DHIS2 End-to-End Exchange Evidence

PubliPulse v0.99.0 adds a controlled end-to-end interoperability simulation. The flow validates a DHIS2 metadata snapshot, verifies versioned indicator and organisation-unit mappings, constructs deterministic DHIS2 aggregate data values, submits them through the in-memory controlled adapter, exercises idempotent replay, and reconciles local versus external record counts and totals.

The simulation produces a payload digest and an external test reference, but it does not contact a real DHIS2 server. `transport_verified` is true only for the controlled harness result and must never be interpreted as proof of production connectivity. Metadata drift or missing mappings fail closed before submission.

The intended production pathway remains: governance authorization -> verified metadata -> deterministic mapping -> exchange payload -> provider transport -> immutable receipt/provenance -> reconciliation -> outcome integrity review. PubliPulse remains African-scale by design; country-specific DHIS2 structures are configuration and mapping data, not hard-coded Uganda assumptions.

## Outcome Intelligence

PubliPulse treats case closure and problem resolution as different states. A case may be administratively closed while resolution remains unverified. The platform therefore supports outcome-gap detection, recurrence pattern tracking, and structured expert recommendations linked to evidence and context.

Core outcome states include `resolution_unverified`, `resolved`, `improved`, `no_change`, `worsened`, `inconclusive`, `reopened`, and `recurrent`. Recurrence patterns use stable non-identifying keys and remain tenant scoped. Expert recommendations are structured learning inputs and do not automatically become clinical, outbreak, or causal determinations.

## Outcome Intelligence and Root-Cause Learning

PubliPulse distinguishes administrative closure from demonstrated resolution. It identifies unresolved outcomes, missing follow-up, recurrence after action, worsening outcomes, and inconclusive evidence. Recurring patterns can be reviewed without treating recurrence as proof of a shared cause. Root-cause hypotheses preserve supporting and disconfirming evidence, confidence, and review status so competing explanations remain explicit and human-reviewable. Expert recommendations can inform interventions, while intervention evaluations preserve uncertainty and do not convert temporal association into causal claims.


## Pilot workflow

The district weekly review can now persist an append-only human decision and next-check checkpoint through the weekly decision/learning record. See `docs/WEEKLY_DECISION_LEARNING.md`.
