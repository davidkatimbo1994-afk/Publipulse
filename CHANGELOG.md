# Changelog

All notable changes to PubliPulse. Newest first.

## Unreleased — Polish and debug pass
- Migration 042: invitation lifetime limit is now an exact 720 hours. Migration 040's calendar "30 days" could be an hour short across a daylight-saving change and wrongly reject a 30-day invitation on a server with a DST time zone. (040 is left untouched so an already-applied checksum still matches.)
- USSD callback with no `text` field is treated as a first dial instead of a bad request.
- Compiled-run variants `provision:org:dist` and `purge:sender-events:dist` for machines without development dependencies (`tsx`); documented.
- Sidebar working-area count was hard-coded to 10; it now follows the list. Removed a leftover no-op in the Community reports screen. A dropped connection now reads "Could not reach the server" instead of "Failed to fetch". Queue status parsing made explicitly type-safe.
- Checked and found correct: promote writes the same columns and values as the real signal creation (source type, precision and summary rules all satisfied), audit outcome values, CORS allows PATCH and the new headers, gateway requests carry no Origin so pass the origin check, the mobile menu lists every area.
- Route and store files were type-checked against stubbed Fastify and Node types: no errors in the new logic (stub-only noise remains). Tests 351/351.

## Unreleased — Step 4: community USSD/SMS intake with a review queue
- Migration 041: `community_intake_submissions` (append-only, no phone number), `community_intake_reviews` (one final decision each: promoted, merged, dismissed), `community_sender_events` (keyed hashes only, no link to submissions, purgeable). Tenant RLS on all three.
- Shared: `community-flow.ts` (USSD and SMS conversation as pure functions: consent first, menus, nothing kept from an incomplete or declined session) and the review schema.
- API: `/inbound/community/ussd` and `/inbound/community/sms` (shared secret in a header, form-encoded, higher rate limit, Africa's Talking reference adapter); `GET /v1/community-intake/queue`, `GET /v1/community-intake/stats`, `POST /v1/community-intake/:id/review`. Limits per ADR-008 (sender hourly and daily, duplicates, cooldown, organisation cap with a once-an-hour audit), refusal of phone or ID-like text, one generic reply for every limit. Promotion creates the signal and the decision in one transaction. Off unless fully configured; a partial setup stops start-up. `npm run purge:sender-events` for the 30-day retention.
- Web: **Community reports** screen (waiting, oldest age, median hours to decide; promote, link or dismiss; decisions are final).
- Docs: `docs/COMMUNITY_INTAKE.md`, ADR amendments, grants in `docs/DEPLOYMENT_SECURITY.md`, API reference, `docs/PILOT_READINESS.md` (gates still to close and measures to agree before a pilot).
- Found and fixed while testing: the sender hash kept a leading `+`, so `+254...` and `254...` would have counted as different people and avoided the limits. Now digits only.
- Tests: `scripts/test-community-intake.test.mjs` (31) and 4 more in `check-resource-ui.test.mjs`. Migration counts raised to 41. `node --test scripts/*.test.mjs` 349/349. NOT run: PostgreSQL for the three new tables, a live gateway or phone, `npm install`, a real typecheck (the new API files type-check apart from the missing Node types here), browser QA. No outbound SMS provider and no translations are included.

## Unreleased — Organisation onboarding
- Migration 040: `organization_invitations` (hashed one-time codes, 1 to 30 days, tenant RLS, no deletes, close-once trigger); `organizations.country_code` no longer defaults to `UG` and must be two upper-case letters for new rows (existing rows untouched, `NOT VALID`); `organization_memberships.updated_at`.
- API: `GET /v1/members`, `PATCH /v1/members/:userId`, `POST/GET /v1/invitations`, `POST /v1/invitations/:id/revoke`, `POST /v1/invitations/redeem`. Owners and administrators manage membership; administrators cannot handle owners, administrators or auditors; no self-changes; the last active owner is protected under row locks; every change is audited; the code is shown once and only its hash is stored; redemption is rate limited, gives one error for every failure and does not audit failures.
- Operator tool: `npm run provision:org -w @publipulse/api -- --name ... --country XX [--owner-sub uuid] [--invite-days n] [--dry-run]`, using `PROVISION_DATABASE_URL`. Creates the organisation and first owner (membership or one-time invitation) in one transaction with an audit row.
- Web: Settings, Team and permissions is live when a session is connected (members, change role, suspend, invite, withdraw, one-time code display); Settings, Account has "Join with an invitation code". The demonstration team panel remains when not connected.
- Docs: `docs/ORGANISATION_ONBOARDING.md`; API reference rows.
- Fixed during review: the documented minimum runtime grants gave SELECT only on `organization_memberships`, so the new endpoints would have failed with permission errors. `docs/DEPLOYMENT_SECURITY.md` now lists the INSERT and column-limited UPDATE grants (and none on `organizations`), with a test tying them to the store's SQL. The join card no longer says "connection above".
- Tests: `scripts/test-onboarding.test.mjs` (14) and 4 more in `check-resource-ui.test.mjs`. Migration counts in three tests raised to 40. `node --test scripts/*.test.mjs` 313/313. NOT run: PostgreSQL (locks, trigger, RLS), real OIDC, `npm install`, a full TypeScript build, browser QA. Route file was checked by tests reading its source, not executed under Fastify.

## Unreleased — Web screens for costs, stock and context; step 4 decisions
- Web: three new working areas, **Costs**, **Stock** and **Context**, on the existing client calls. They show only records from the connected organisation (no demonstration data) and say so when nothing is connected. Banner mode `live-only` added.
- Costs: per-action planned/actual totals beside outcome counts and actual cost per improved assessment (labelled not cost per life saved; currencies never added), drill-down to entries, add-entry form, CSV download.
- Stock: forecast table sorted by urgency with text-labelled levels, adjustable lead time (1-180 days), limits stated on screen, draft service-disruption text with a Copy button only (nothing is submitted), record-a-count form, CSV download.
- Context: context around a signal by signal ID with the association-only notice (warns if the server does not confirm it), comparison with earlier periods, recorded-observations list with area filter, record-an-observation form. New client call `listContextObservations`.
- Forms validate against the same rules as the shared schemas before sending, reuse one client mutation id for a retry of the same entry, and refresh after a save. Server role checks still decide who can save.
- Docs: ADR-006 to ADR-009 settle step 4 (inbound USSD/SMS intake): provider-neutral gateway adapter, consent wording and what is kept, abuse limits and sender hashing, review queue before signal. **Decisions only: no intake code, migration or screen exists yet.** Limits and wording are starting values to calibrate and get reviewed.
- Tests: `scripts/check-resource-ui.test.mjs` (13). `node --test scripts/*.test.mjs` 295/295. New files type-check under `tsc --strict` against a React stand-in with only stand-in-caused errors. NOT run: `npm install`, real typecheck, production build, browser QA, Postgres.

## Unreleased — External context data
- API: append-only `external_context_observations` (migration 039, RLS forced, update/delete rejected): area-level metrics (rainfall, water access, prices, ...) per period of at most 31 days, with required source label and optional https source URI. `POST/GET /v1/context/observations` and `GET /v1/signals/:signalId/context`.
- The signal context view returns observations from 28 days before to 7 days after the signal, and compares each metric (same unit only) with up to 8 earlier periods of the same area: above / below / similar, or `insufficient_baseline` with fewer than 3 earlier periods. The response states `association_in_time_only` and `causalClaim: false`.
- Data is entered through the API (no automatic fetching from weather or other external services; no network egress added).
- Shared: `ExternalContextObservationSchema`, `compareContextToBaseline`, `contextWindowFor`. Web: `loadSignalContext` / `recordContextObservation` client calls (no UI yet).
- Verified here: migration chain/checksums, SQL guards, guard tests. NOT run: `npm install`, vitest, typecheck, Postgres.

## Unreleased — Commodity stock forecasting
- API: append-only `commodity_stock_snapshots` (migration 038, RLS forced, update/delete rejected) with `POST /v1/stock/snapshots` and `GET /v1/stock/forecast`. Consumption velocity is derived at read time from consecutive snapshots (previous on-hand + received - current on-hand, per day); days of stock left, projected stock-out date and a critical/warning/ok/insufficient_data level follow, using a resupply lead time (default 7 days, `leadTimeDays` 1-180).
- Honest limits: steady consumption assumed, deliveries in transit are not modelled, intervals where stock rose without a recorded receipt are skipped and counted, series older than 30 days are `insufficient_data`.
- Critical series carry a draft `service_disruption` signal for a person to submit through the existing intake. Nothing is created automatically (`signalsCreatedAutomatically: false`).
- Shared: `StockSnapshotSchema`, `forecastStock`, `buildSeriesForecast`. Web: `loadStockForecast` / `recordStockSnapshot` client calls (no UI yet).
- Verified here: migration chain/checksums, SQL guards, guard tests. NOT run: `npm install`, vitest, typecheck, Postgres.

## Unreleased — Action cost evidence
- API: append-only `action_cost_entries` (migration 037, RLS forced, update/delete rejected by trigger) with `POST/GET /v1/actions/:actionId/costs`. Entries are planned or actual, categorised, bounded, replay-safe via `x-client-mutation-id`, audited, and the GET returns totals per currency and planned/actual (currencies are never mixed).
- Shared: `ActionCostEntrySchema` and `totalActionCosts`. Web: `loadActionCosts` / `recordActionCost` client calls (no UI yet).
- API: `GET /v1/costs/summary` joins each action's cost totals to its outcome assessment counts and reports actual cost per *improved assessment* per currency (labelled `notCostPerLifeSaved`). Web client: `loadCostSummary`.
- Not changed: existing tables, outcome logic, auth, offline queue. No UI yet.
- Verified here: migration chain, checksums, SQL arity/column guards and new `scripts/check-action-cost.test.mjs` pass. NOT run: `npm install`, vitest (`packages/shared/test/action-cost.test.ts`), typecheck, Postgres.

## Unreleased — Responsive UX completion (web areas)
- Web: Investigations, Outcomes, Weekly Review, Intelligence, Interoperability and Settings rebuilt on the shared UI kit (search/filters, summary tiles, empty states, labelled tables, no inline styles). `areas/OtherAreas.tsx` removed; each area has its own file.
- Web: new `context/WorkspaceContext.tsx` (session-only members, evidence, decisions, sign-off) and `data/org.ts` (demo organisation, role names and permission matrix taken from the roles the API enforces).
- Web: Settings now has Account and organisation, Team and permissions (administrators: list, change role, suspend, add; role-by-capability table) and Offline and sync.
- Web: Intelligence is calculated from the Action Gaps list instead of fixed claims; Outcomes can record evidence (no hash is invented for session records); Weekly Review summary is computed from current signals, gaps and actions and sign-off asks for confirmation.
- Web: Interoperability pause/resume is administrator-only and labelled as a display change for this session.
- Field: PP brand mark in the header and a fixed bottom navigation bar on phones (CSS and header markup only; offline queue and sync code untouched).
- Not changed: API, database, migrations, auth, offline queue. Users, evidence and decisions added in the web UI are NOT sent to the server.
- Verified here: `node --test scripts/*.test.mjs` 273/273. Web sources checked with `tsc --strict` against a React stand-in (no errors in changed files). NOT run: `npm install`, real typecheck, production build, browser QA.

## Unreleased — Docker
- Added `Dockerfile` (targets `api`, `web`, `field`), `docker-compose.yml` (db, migrate, api, web, field), `docker/` (nginx config, migration runner, dev-only runtime role), `.dockerignore`, `.env.docker.example`, `docs/DOCKER.md`, and `scripts/check-docker-files.test.mjs`. Not built or run in the authoring sandbox (no Docker, Postgres or network); validated by static tests only.

## Unreleased — debug pass
- Field: a network error mid-sync no longer skips the queue refresh; syncing stops on 401/403 instead of marking every item "rejected"; rejected/conflicting items show the server error code and can be removed after confirmation; IndexedDB `abort` (quota) now rejects instead of hanging; area input capped at 80 chars; capture form warns that dates like 2026-11-03 are rejected.
- Web: queue flush moved out of a state updater (duplicated signals in dev); new "Retry sync now" and "Remove" for queued signals, with the original client id and observed time reused on retry; `crypto.randomUUID` replaced by `newClientId` (crashed on plain-http origins); Connected Workspace no longer updates the provider during render and keeps its config across area switches; a half-typed API URL no longer enables "Live session"; new-action due date is relative to today and the form resets on open; investigation progress is keyed to the signal, not list position; whole-number chart ticks; zero-target guards; "Open actions" label; session-unique signal/action ids.
- Added `scripts/check-debug-pass-fixes.test.mjs` (8 tests), `lib/api-config.ts`, `lib/client-id.ts`, `vite-env.d.ts` for web.
- Still open: the identifier guard treats ISO dates, dotted dates and spaced large numbers as phone numbers, in both `data-boundary.ts` and the DB checks in migration 027; fixing it needs a new migration (037) and refreshed checksums. `package-lock.json` is still missing.

## Unreleased — charts, live API charts, working buttons
- Added dependency-free SVG/CSS charts (`apps/web/src/components/charts/`): epidemic curve, severity bars, response-time-vs-target bars, weekly trend lines. Every chart has "View as table" and "Download CSV".
- Added live API charts in the admin Connected Workspace: weekly-review district funnel and 7-1-7 clocks with completeness counts. Parsers (`data/apiCharts.ts`) tolerate malformed payloads.
- Added CSV export (`lib/csv.ts`, spreadsheet-formula guard) and a "Download CSV" button on Signals (reporter names and notes excluded).
- Fixed `loadWeeklyReview` reading `body.review`; the API returns `summary`.
- Fixed three buttons that did nothing: Investigations "Open field form" (now a session-only step checklist that drives the progress bar), Outcomes "Export Report" (now downloads a CSV), Weekly Review "Sign-off" (now records a session-only sign-off, administrators only).
- Connected Workspace buttons now explain why they are greyed out until the API URL, organization ID and token are entered.
- Fixed failing test `check-outcome-ui-api-connection` (a comment in `api-client.ts` contained the word the test forbids).
- Added `scripts/check-charts.test.mjs` (10 tests) and `scripts/check-no-dead-buttons.test.mjs` (fails if a button has no handler).
- Still demonstration data: the epidemic curve and the Outcomes weekly trend lines. No endpoint returns daily or weekly history yet.
- Still open: `package-lock.json` is not in this package; run `npm run lockfile:refresh` on a networked machine.

## Unreleased — correctness fixes
- Fixed outcome INSERT (18 columns, 17 placeholders): recording any outcome assessment failed in PostgreSQL.
- Fixed `indicator_code` overflow (121 > 120 chars), `assessment_method` overflow (3000 > 1000), and `evidence_source` limit mismatch (API allowed 2048 and empty; DB allows 1..240). Valid API input no longer becomes a 500.
- Fixed `OutcomeStore` interface missing the `clientMutationId` argument (TypeScript compile error in the route).
- Concurrent duplicate outcome submissions now resolve to the stored outcome instead of a 500.
- Web client reuses one client mutation id for the live attempt and the offline retry, so a retry after a lost response cannot save the outcome twice.
- Added `check:sql` (arity + schema-aware column guards) to CI, with tests that prove the guards fail on bad SQL.
- Added behavioural tests for `PostgresOutcomeStore` using a constraint-aware fake.
- Fixed idempotent outcome replay: a reused `x-client-mutation-id` for a different signal or action now returns 409 `client_mutation_id_conflict` instead of a false 201 with another outcome.
- Duplicate-key recovery in `PostgresOutcomeStore` no longer holds two pool connections at once (pool-exhaustion deadlock risk).
- Shared: fixed import-time crash (`publicHealthNarrative(...).trim()` on a non-string schema in `outcome-intelligence.ts` and `outcome-root-cause.ts`); `publicHealthNarrative` now returns an honest `ZodEffects` type so this cannot recur silently. Removed duplicate/invalid re-exports in `signal.ts` and a possibly-undefined access in the CSV parser.
- API: fixed type errors (DHIS2 type imports, missing `ReconciliationSnapshotInput` import, duplicate `feedback_recorded` select and incomplete row types in the workflow-case store, `pending_durability` row type, upstream insert guard, reporter-feedback input/transport types). `Dhis2Adapter.execute` no longer posts an object as `dataValues`. Reporter-feedback intake rejects any `deliveredAt` with `delivery_status_not_assertable_at_intake`.
- Test harness: removed an unknown `version` key from the controlled DHIS2 metadata fixture that the strict schema rejected; fixed a syntax error in `learning.test.ts`.
- Web: fixed unbalanced JSX in the weekly-review panel and a misplaced offline-queue block in `loadConnectedWorkflow`; offline outcome retry now reuses the live attempt's client mutation id.
- Docs: added `docs/API_REFERENCE.md`; corrected stale lockfile status and duplicate sections in `README.md`; documented optional DHIS2 variables in `.env.example`.
- API build: `action-gap-routes.ts` header type now accepts `| undefined` (required by `exactOptionalPropertyTypes` when passing Fastify's `IncomingHttpHeaders`; was 4 TS2375 errors); the Fastify `err` log serializer now returns the required `type`/`message`/`stack` fields with message and stack redacted (was TS2769 at `app.ts:61/69`).
- Windows: six script tests built file paths from `new URL(..., import.meta.url).pathname`, which yields `/C:/...` and became `C:\C:\...` (ENOENT) on Windows; they now use `fileURLToPath`, and `scripts/check-windows-paths.test.mjs` blocks the pattern from returning.
- Tests: `apps/api/src/action-gap/reconciliation.test.ts` used `node:test`, so `vitest run` found no suite and failed `npm test`; converted to vitest, with `scripts/check-test-runner.test.mjs` guarding against it recurring.
- Tests: five transpile-based script tests no longer fall back to a Linux-only `/opt/nvm/...` TypeScript path; when `typescript` is not installed they now fail with "Run `npm ci` at the repository root".
- Install: rewrote all 291 `resolved` URLs in `package-lock.json` from a private `http://` mirror to `https://registry.npmjs.org/` (integrity hashes unchanged) and refreshed `package-lock.sha256`; `verify-lockfile` now fails on any non-registry URL or missing integrity hash (new `scripts/verify-lockfile.test.mjs`). Removed a hollow, partially-copied `node_modules` (291 empty package folders, workspace links stored as real directories) from the release archive.
- Restored `apps/api/package.json` (was empty, which broke `npm install` and every manifest check); scripts are `dev`, `build`, `start`, `typecheck`, `test`, `test:db`.
- Field dev proxy and docs now target the API default port 4000 (they pointed at 3000).
- `verify-lockfile.mjs` and `check-release-readiness.mjs` now include the `apps/field` workspace; the lockfile still needs regenerating to add it (run `npm install`, or the lockfile-bootstrap workflow).
- Web: split `main.tsx` into `main.tsx`, `App.tsx` and `lib/` (types, demo cases, format helpers, IndexedDB field queue). Source-contract tests read the whole folder via `scripts/lib/web-source.mjs`.
- CHANGELOG restructured: one title, consistent `## vX.Y.Z` headings, newest first. No entries removed.
- CI: added job timeouts. `.gitignore`: added `*.tsbuildinfo`, `dev-dist/`, `.vite/`.
- Field: intake categories, sources and precision now match `SignalIntakeSchema` (the old values such as `water_quality`, `chw` and `ward` were rejected by the API's strict enums).
- Field: every request now sends `x-organization-id` (the API rejects requests without it); the Sync tab has an Organization ID input.
- Field: queued outcome assessments now POST to `/v1/signals/:signalId/outcomes` with an `x-client-mutation-id` header (the route `/v1/outcomes` does not exist), and mutation bodies no longer carry an extra `clientMutationId` key that the strict schemas reject.
- Field: removed an unused `enqueueMutation` import that failed `tsc` under `noUnusedLocals`; `newClientId()` now always returns a valid UUID, including on plain-http origins where `crypto.randomUUID` is missing.
- Field dev proxy drops the `Origin` header so same-origin POST/PATCH are not refused by the API's single-origin check.
- API CORS now allows the `x-client-mutation-id` header, which the web app sends when saving outcome assessments (browser preflight previously blocked it).
- Added `scripts/check-field-api-contract.test.mjs` to keep field options, headers, routes and CORS in step with the shared schemas and API.
- Docs: README status table (lockfile, typecheck/build, field contract), field README, Phase 4, APP_STRUCTURE and DEPLOYMENT_SECURITY updated to match the code; README now cites `docs/RELEASE_GATES.md` instead of the non-existent `PRODUCTION_READINESS.md`.
- API: `WEB_ORIGIN` now accepts up to five comma-separated exact origins (for example web + field PWA); wildcards, paths and plain-HTTP production origins are still rejected at startup, and only the requesting origin is echoed in `Access-Control-Allow-Origin`. New `parseWebOrigins()` in `server-config.ts`, covered by node and vitest tests.
- Field: new **Update** tab to create action updates and outcome assessments offline, validated by `mutation-builders.ts` against the API's strict rules; the queue now marks each item `conflict`, `rejected` or `retry` after a sync attempt and the sync message counts server rejections separately.
- Field: signal summary now enforces the API's 10 to 1000 character limits (it accepted 1 to 2000, so short or long summaries were rejected by the server).
- Added `npm run lockfile:refresh` (regenerates `package-lock.json` including `apps/field`, rewrites `package-lock.sha256`, then runs `verify-lockfile`).

## v1.19.1 — Pilot operations hardening

- Added replay-safe client mutation identity to weekly decision evidence.
- Added database uniqueness protection for organization-scoped weekly decision replay.
- Preserved append-only decision records and tenant RLS.
- Strengthened pilot closeout documentation and acceptance criteria.

## v1.19.1 — Debug & Field Queue Hardening

- Fixed IndexedDB version downgrade failures between the field signal queue and mutation queue.
- Prevented HTTP 4xx/5xx responses from being incorrectly queued as offline signal submissions.
- Queued outcome assessments on detected fetch/network failures even when `navigator.onLine` is stale.
- Synchronized the web preview version with the release package version.
- Added regression contracts for the field queue and retry behavior.

## v1.18.0

- Added append-only district weekly decision evidence with explicit follow-up checkpoints.
- Added role-gated weekly learning decision recording.
- Added data-boundary validation to decision rationale.
- Added tenant-scoped RLS and audit evidence for weekly decisions.

## v1.17.0 — Pilot Evidence Record

- Added immutable, tenant-scoped pilot evidence snapshots.
- Server-calculated baseline-versus-pilot outcome comparison is persisted with structured implementation incident counts.
- Added append-only PostgreSQL storage with forced RLS.
- Added bounded validation and regression checks for pilot evidence.

## v1.16.0

- Added explicit baseline-versus-pilot outcome-completeness comparison endpoint.
- Added privacy-bounded pilot comparison validation and documentation.
- Preserved non-causal interpretation and explicit cohort-window requirements.

## v1.15.0 — Pilot reconciliation evidence

- Added an authenticated reconciliation-recording boundary for controlled upstream pilot adapters.
- Added conservative local-vs-external count/total reconciliation using existing append-only snapshots.
- Added tenant-scoped reconciliation provenance and audit evidence.
- External transfer remains disabled by default; reconciliation evidence does not imply external acceptance.

## v1.14.0 — Controlled DHIS2 Pilot Transport Readiness

- Fixed an integration-profile state mismatch: upstream intake now requires the declared `verified` state used by the shared schema and database, instead of the nonexistent `active` state.
- Added a deployment-time DHIS2 metadata smoke test with HTTPS enforcement, explicit hostname allowlisting, redirect rejection, bounded timeout, and runtime-only bearer credentials.
- Kept external transport opt-in and outside the normal test harness; no live production DHIS2 connection is claimed.
- Added static regression coverage for the profile-state contract and staging transport safety controls.

## v1.13.0 — Reporter feedback replay and delivery hardening

- Added organization-scoped reporter-feedback replay protection with client mutation IDs.
- Added append-only provider-neutral delivery-attempt evidence.
- Added deployment-configured feedback dispatch boundary; no SMS/USSD provider is hard-coded.
- Added delivery hardening contract tests.

## v1.13.0 — Controlled Upstream Event Intake

- Added a provider-neutral upstream event boundary with a bounded DHIS2 normalization contract.
- Added immutable upstream event receipts with tenant RLS and replay-safe external-event identity.
- Added a staging intake endpoint; it requires an active DHIS2 integration profile and never performs external transfer.
- Preserved the upstream system as detection/source-of-record; PubliPulse remains the outcome/accountability overlay.

## v1.11.0 — Offline outcome replay hardening

- Added organization-scoped client mutation idempotency for offline outcome assessments.
- Added `X-Client-Mutation-Id` validation and replay handling.
- Updated the field workflow to preserve deterministic outcome replay across reconnects.


- Added a tenant-scoped weekly district review API with minimum-cell suppression.
- Added explicit review priorities for unresolved outcomes, recurrence, response blockers and ownership gaps.
- Added a district-facing weekly review workspace without exposing individual records in aggregate views.
- Preserved descriptive/non-causal interpretation and the existing outcome-first overlay boundary.

## v1.9.0 — Data Lifecycle Review Hardening

- Added legal/operational retention holds with tenant isolation.
- Added append-only retention disposition review evidence.
- Added shared retention decision logic with explicit hold precedence.
- Expired data is only marked eligible for review; no automatic deletion is authorized.

## v1.9.0 — Complete the nine-point outcome roadmap

- Added explicit 7-1-7-aligned notification and response-start clocks plus a separate time-to-measured-outcome clock.
- Added append-only, privacy-bounded reporter feedback API and missing-feedback Action Gap detection.
- Added conflict-aware offline action/outcome mutation contracts and field-workspace synchronization controls.
- Added comparative uniqueness review documenting what Africa CDC EMS, DHIS2 Tracker/Event, WHO EWARS, Kenya m-Dharura, Nigeria SITAware and commercial incident tools already cover.
- Kept live external transfers, causality claims, and production data readiness behind real deployment evidence gates.

## v1.8.3 — Production Logging & Error-Exposure Hardening

- Hardened API error logging so production logs retain only safe error name/code metadata and request correlation IDs; full error objects are no longer serialized by the application error handler.
- Added a structured Fastify error serializer that excludes error messages, stacks, and arbitrary properties from serialized error logs.
- Preserved the existing response boundary: clients receive stable error codes and request IDs rather than internal database or identity-provider details.
- Kept the real-data boundary, tenant RLS, audit immutability, retention policy declarations, interoperability idempotency, and fail-closed transport controls unchanged.
- Validation remains limited to dependency-free/static checks in this environment; a committed package-lock.json and dependency-backed CI remain required production gates.

## v1.8.2 — Production lifecycle and audit hardening

- Added organization-scoped data-retention policy declarations with bounded retention periods.
- Added database-level defense-in-depth rejection of common direct identifiers in audit metadata.
- Fixed interoperability idempotency replay lookup to include the persisted contract fingerprint, preventing false conflicts on legitimate retries.
- Kept retention enforcement as an explicit operator-controlled gate; policy declaration alone never authorizes deletion.

## v1.8.1 — Production data-boundary hardening

- Added shared public-health narrative boundary checks for common direct identifiers.
- Added PostgreSQL defense-in-depth checks for signal and evidence narratives.
- Added migration 027 and checksum coverage.
- Kept direct patient identifiers out of the product data model; this is not a substitute for a formal privacy/DPIA review.

## v1.8.0 — Outcome decay integrity and query hardening

- Prevent recently measured outcomes from being counted as durable before the full 30-day observation window has elapsed.
- Expose a `pendingDurability` count so supervisors can distinguish unresolved durability from outcomes that are still being observed.
- Harden operational-learning `days` and `minCell` query parameters with canonical decimal parsing and bounded safe integers.
- Add regression coverage for the durability-window and query-validation rules.

## v1.6.1 — Production polish and request-boundary hardening

- Centralized strict decimal pagination parsing across API list endpoints; rejects arrays, signs, decimals, whitespace, leading-zero aliases, hex and exponent notation.
- Added response request IDs for operational correlation without exposing authentication or health-data payloads.
- Kept production transport, identity, database and privacy gates fail-closed.
- Static engineering suite: 175/175 tests passed.

## v1.6.0 — Production hardening for controlled real-data pilots

- Wired persistent action-handoff storage into the production server and readiness gate.
- Added production HSTS.
- Added strict interoperability idempotency-key validation and contract-fingerprint conflict detection.
- Forced tenant RLS across Phase 7 interoperability and outcome-learning tables.
- Added append-only protection for exchange jobs/receipts and an explicit exchange-job state machine.
- Expanded the PostgreSQL RLS integration harness to cover the full tenant-scoped Phase 7/outcome surface.
- Added a production-readiness document separating implemented controls from deployment, privacy, security and governance evidence that must still be supplied by the operator.
- Static engineering suite: 173/173 tests passed.

## v1.5.0 — Phase 7 interoperability groundwork completed

- Completed the provider-neutral interoperability evidence boundary for future DHIS2/FHIR-style exchange.
- Added versioned exchange envelopes with payload digests and explicit privacy-suppression metadata.
- Added deterministic offline aggregate CSV serialization/parsing.
- Added explicit FHIR-style Bundle profile metadata without claiming live FHIR connectivity.
- Added tenant-safe foreign-key boundaries from exchange jobs to integration profiles and programmes.
- Added minimum-cell suppression semantics that never convert suppressed values to zero.
- Updated migration/checksum and release verification for the 24-migration chain.
- Verified the complete static contract suite: 166/166 tests passed.
- No live external transfer is enabled or claimed.

## v1.4.0 — Outcome Intelligence workspace

- Added an outcome-first review workspace for unresolved-after-closure and recurring patterns.
- Added explicit learning guardrails distinguishing recurrence, observed improvement, expert hypotheses, and demonstrated resolution.
- Updated preview version labels and workspace package versions to 1.4.0.

v1.3.1 — Outcome Effectiveness Integrity Polish

- Hardened persistent-problem count invariants without modifying previously applied migrations.
- Added migration 023 for bounded unresolved/recurrence counts.
- Hardened runtime classification inputs for persistent-problem analysis.
- Corrected migration checksum and release-count verification for the 23-migration chain.

## v1.3.0 — Outcome Effectiveness & Persistent-Problem Learning

This increment deepens PubliPulse around its core outcome mission. It adds deterministic, bounded synthesis of intervention evaluations and a persistent-problem assessment model. PubliPulse can distinguish an emerging recurrence pattern from a persistent problem and can flag a pattern as intervention-resistant when multiple interventions have been tried and recurrence continues. Learning classifications remain operational evidence, not causal or clinical-effectiveness claims. New evidence records are tenant-scoped and append-only.

## v1.2.0 — Outcome Root-Cause & Recurrence Learning

- Added explainable recurrence similarity using category, administrative area, issue tags, and failure-mode evidence.
- Added recurrence classification for isolated, emerging, and persistent patterns.
- Added structured root-cause hypotheses with supporting and disconfirming evidence.
- Added root-cause review history with explicit uncertainty and non-support decisions.
- Added tenant-scoped, append-only database structures for recurrence assessments and root-cause learning.
- Preserved the non-causal boundary: recurring observations and expert hypotheses do not prove a common cause or intervention effect.

## v1.1.0 — Outcome Learning Evaluations

- Added deterministic outcome-review findings for unresolved, unmeasured, recurrent, worsened, and inconclusive cases.
- Added append-only outcome review tasks.
- Added append-only expert recommendation review history.
- Added intervention evaluation records that distinguish supported, mixed, not-supported, and insufficient-evidence learning.
- Kept academic/programme context out of the product.

## v1.0.0 — Outcome Intelligence foundation

- Distinguishes administrative closure from evidenced resolution.
- Adds outcome-gap classification for closed-without-resolution, recurrence, missing measurement, worsening, and inconclusive results.
- Adds tenant-scoped recurrence pattern records with non-identifying stable keys.
- Adds structured, evidence-referenced expert recommendation records for human review.
- Keeps outcome-intelligence history append-only and fail-closed under tenant RLS.

## v0.99.0 — Phase 7G: Controlled DHIS2 End-to-End Exchange Evidence

- Added deterministic mapping of PubliPulse aggregate records to DHIS2 data-element and organisation-unit UIDs.
- Added payload SHA-256 evidence digest generation.
- Added controlled end-to-end simulation: metadata validation, mapping, payload construction, adapter submission, idempotent replay and reconciliation.
- Added fail-closed tests for metadata drift and missing organisation-unit mappings.
- The controlled harness deduplicates identical submissions and returns the original external test reference on replay.
- No real DHIS2 server is contacted and no production transport is enabled by this release.

## v0.98.0 — Phase 7F: DHIS2 Metadata Mapping & Organisation-Unit Reconciliation

- Added versioned DHIS2 indicator mapping declarations.
- Added country-scoped DHIS2 organisation-unit mappings.
- Added deterministic metadata snapshot validation and mapping drift detection.
- Added append-only reconciliation-run evidence storage with tenant RLS.
- Drift is explicit and must be reviewed before automatic exchange; metadata alignment is not proof of live connectivity.

## v0.97.0 — Phase 7E: Controlled DHIS2 Test Harness

- Added a deterministic in-memory DHIS2-compatible HTTP test double.
- Added a test-only credential provider with no persisted secrets.
- Added controlled adapter execution proof for aggregate export.
- Added authentication-failure coverage and an explicit no-network test boundary.
- No production route enables the controlled harness or real external transport.
- No live DHIS2 integration is claimed or enabled by this release.

## v0.96.0 — Phase 7D

- Added append-only interoperability provenance events.
- Added append-only reconciliation snapshots with count/total deltas and conservative status classification.
- Added receipt fingerprint/response digest fields and explicit transport verification flag.
- Added reconciliation contract tests and migration-chain/checksum coverage.
- No live DHIS2 integration is claimed or enabled by this release.

## v0.95.0 — Phase 7C: External interoperability exchange boundary

- Added versioned interoperability exchange contracts.
- Added provider capability validation and verified-profile gating.
- Added country indicator mapping-version enforcement.
- Added administrative-unit mapping table foundation.
- Added idempotent exchange-job and receipt persistence.
- Added tenant-scoped RLS for exchange state and receipts.
- Added disabled external transport adapter boundary.
- Added fail-closed exchange validation tests.
- No live DHIS2/FHIR/external transfer is claimed or enabled.

## v0.93.0 — Operational Learning

- Added tenant-scoped operational-learning aggregates with minimum-cell suppression.
- Added category and administrative-area workflow pattern summaries.
- Added explicit non-causal interpretation and individual-record exclusion.
- Added Phase 6 API/store contracts and static verification.

## v0.92.1 — Phase 4–5 verification repair

- Corrected the static field/evaluation contract test.
- Kept the release gate separate from product-phase work.

## v0.92.0 — Evaluation and Governance

- Added descriptive workflow evaluation metrics.
- Added an explicit evaluation protocol and governance checklist.
- Preserved the boundary between implementation metrics and causal/clinical claims.

## v0.91.0 — Field Operations

- Added offline-capable field signal capture using IndexedDB.
- Added idempotent client submission IDs for queued synchronization.
- Added field language preference and configurable administrative-area precision.
- Added explicit privacy guidance preventing patient identifiers in field intake.
- Added queue synchronization that retains failed submissions.

## v0.90.1 — Strict TypeScript repair

- Corrected strict optional-property handling in workflow-case evidence mapping.
- Typed PostgreSQL workflow-case test doubles to satisfy the generic query contract.
- Narrowed unknown Fastify errors before reading HTTP status codes.
- Made audit cursor selection safe under unchecked-index typing.
- Omitted absent production configuration values rather than passing explicit `undefined`.
- Corrected a workflow test fixture to use `null` for an unassigned owner.

## v0.90.0 — Signal-to-Outcome workflow

- Expanded the web experience from an Action Gap preview into a complete Signal → Investigation → Decision → Response → Outcome workflow view.
- Added a connected-workspace inspector that loads tenant-scoped signals, evidence, investigations, decisions, response actions, outcomes, action gaps and handoff events from the authenticated API.
- Added an accountable action-handoff interface for initiating, accepting, declining and cancelling transfers through the existing audited API contract.
- Kept demo data explicitly synthetic and session-only; no demo action is presented as an authoritative audit event.
- Added a server-backed outcome assessment form that uses the existing strict outcome contract and reloads persisted assessments after a successful write.
- Preserved the core safety boundary: task completion is not treated as proof of public-health impact, and uncertainty remains first-class.

## v0.90.0 — Action Gap reconciliation schema integrity gate

- Added a PostgreSQL schema verification script for Action Gap RLS, organization-scoped fingerprint idempotency, and the append-only audit mutation trigger.
- Wired the script into the PostgreSQL CI job and static release-readiness gate so schema drift is caught after migrations are applied.
- This verifies structural database safeguards, not concurrent application behavior; reviewer-versus-resolver race tests remain outstanding.

## v0.89.0 — Legacy signal-level reconciliation compatibility

- Reconciliation now treats a missing `supporting_evidence.workflowCaseId` as the documented `signal` scope, matching fingerprint generation and preventing legacy signal-level findings from being skipped.
- Added a source-contract regression test for this compatibility path.
- This is a targeted SQL compatibility fix; live PostgreSQL behavior remains unverified.

## v0.88.0 — Reviewer-friendly reconciliation locking

- Automatic reconciliation now uses PostgreSQL `FOR UPDATE SKIP LOCKED` while scanning eligible open, unreviewed findings in stable ID order. If a review transaction already holds a candidate row lock, reconciliation skips that row rather than waiting and potentially resolving it immediately after the review attempt began.
- Added a source-contract regression test for the skip-locked behavior.
- This is not an absolute priority guarantee: if reconciliation locks first, a later review may still receive a conflict. Real PostgreSQL race tests are still required.

## v0.87.0 — Deterministic reconciliation lock ordering

- Automatic reconciliation now locks candidate Action Gap rows in stable ID order. This reduces avoidable deadlock risk when concurrent transactions process overlapping sets of findings.
- Added a dependency-free source-contract regression check for the stable lock order.
- This is a defensive database change, not a substitute for real PostgreSQL race/deadlock tests; live concurrency behavior remains unverified.

## v0.86.0 — Reconciliation Concurrency Contract Guards

- Added static regression checks for row-locking, conditional reviewer updates, transactional audit ordering, rollback behavior, and repeated reconciliation.
- These checks validate source-level safety contracts only; they do not substitute for concurrent transactions against PostgreSQL.
- Live PostgreSQL/RLS tests, dependency-backed application tests, TypeScript build, and production release verification remain outstanding.

## v0.85.0 — Reconciliation Persistence Contract Guards

- Added dependency-free regression checks for organization/signal/workflow-case scoping in automatic Action Gap reconciliation.
- Added checks that reviewed rows are excluded, resolution uses a conditional update, and the resolution audit event is inserted before transaction commit.
- These are source-contract checks, not a substitute for PostgreSQL concurrency/RLS integration tests; those remain a release gate.

## v0.84.0 — Reconciliation Review-State Guard

- Exclude reviewed Action Gap rows from the reconciliation lock/query itself, in addition to the conditional update guard.
- Keep automatic resolution scoped to open, unreviewed findings in the evaluated organization, signal, and workflow case.
- This narrows the reconciliation write set; live PostgreSQL race behavior remains unverified in this environment.

## v0.83.0 — Reconciliation transaction failure guards

- Added a runner regression test proving a reconciliation transaction failure aborts the run rather than continuing to process later workflow cases.
- The test asserts no subsequent case findings are persisted after reconciliation rejects, limiting partial-run ambiguity.
- This is unit-level failure-path coverage, not proof of PostgreSQL locking or concurrent reviewer race behavior.
- Verification: migration chain, migration checksums, workflow action pins, and ZIP integrity checked. Dependency-backed tests/build and live PostgreSQL/RLS concurrency remain unverified.

## v0.82.0 — Reconciliation failure-path guards

- Added runner regression tests proving that a thrown persistence error aborts the run before reconciliation can be called.
- Covered failure on the first case and documented that reconciliation is not attempted after the persistence operation rejects.
- This does not replace PostgreSQL integration tests for row-lock races between human review and automatic resolution.
- Verification: migration chain, migration checksums, workflow action pins, and ZIP integrity checked. Dependency-backed tests/build and live PostgreSQL/RLS concurrency remain unverified.

## v0.81.0 — Reconciliation regression guards

- Added runner regression tests ensuring a case is not reconciled after any finding fails to persist and reconciliation occurs only after all current findings are persisted.
- Kept concurrent database behavior explicitly unverified without a live PostgreSQL integration environment; no concurrency-safety claim is inferred from unit-level tests.
- Verification: migration chain, migration checksums, workflow action pins, and ZIP integrity are checked for this archive; dependency-backed test suite/build and live database tests remain unverified.

## v0.80.0 — Audited Action Gap Lifecycle Reconciliation

- Added organization-scoped transactional reconciliation for open findings absent from a successfully persisted evaluation of the exact workflow case.
- Auto-resolution is limited to open, fingerprinted detections with no reviewer metadata; reviewed findings are preserved.
- Every automatic resolution writes an `action_gap.auto_resolved` audit event in the same transaction.
- Evaluation skips reconciliation when any finding references a missing signal, avoiding closures after incomplete persistence.
- Verification: migration chain, migration checksums, workflow action pins, and ZIP integrity checked; live PostgreSQL/RLS and full dependency-backed tests remain unverified.

## v0.79.0 — Reconciliation safety planning

- Added scoped stale-finding candidates to the pure Action Gap reconciliation planner. A finding is only considered stale when its exact workflow case was included in the current evaluation and its fingerprint is absent from the active findings.
- Stale candidates are limited to detections explicitly marked `open`; acknowledged, dismissed, and resolved reviewer states are not candidates for automatic lifecycle changes.
- Kept lifecycle changes as planner output only: persistence, transaction-scoped tenant enforcement, and audit events are still required before any candidate can be resolved. No automatic closure is performed by this increment.
- Added regression coverage for active findings, reviewed findings, and cases outside the evaluation scope.
- PostgreSQL integration, full application tests/build, and deployment were not run in this environment.

## v0.78.0 — Handoff evaluation correctness

- Corrected workflow snapshot handoff mapping to use the most recent initiation and only an acceptance occurring at or after that initiation. An acceptance from an older transfer can no longer mask a newly pending handoff.
- Kept handoff history tenant-scoped and deterministic when event timestamps tie.
- This is a correctness fix; it does not claim live PostgreSQL verification.

## v0.77.0 — Transactional PostgreSQL handoff store

- Added a PostgreSQL-backed ActionHandoffStore implementation using transaction-local organization context and organization-scoped action locking.
- Validates active recipient membership, limits event transitions to the current pending handoff, and permits accept/decline only by the intended recipient.
- Writes each handoff event and its audit event in the same transaction; list reads are bounded and tenant-scoped.
- The store remains explicitly injected through application options; production wiring and live PostgreSQL concurrency/RLS verification are not claimed.

## v0.76.0 — Authenticated action handoff API boundary

- Added authenticated, role-gated endpoints to append handoff events and read bounded action handoff history.
- Validates action and recipient UUIDs, event types, note length, and history limits; exposes explicit conflict/not-found responses.
- Added an injectable persistence boundary so the API fails closed with 503 when handoff storage is not configured.
- PostgreSQL implementation and transaction-level state transition enforcement remain required before enabling this capability in a deployment.

## v0.75.0 — Persisted action handoff history

- Added organization-scoped `action_handoff_events` to record initiated, accepted, declined, and cancelled responsibility transfers.
- Enforced tenant RLS, append-only event history, action/organization referential integrity, and an index for latest handoff events.
- Connected the workflow-case loader to persisted initiation and acceptance timestamps so the existing stalled-handoff rule can evaluate recorded evidence.
- Handoff SLA is currently a conservative two-day default; configurable policy and a dedicated write API for handoff events remain follow-up work.
- No live PostgreSQL migration, end-to-end test, full build, or deployment is claimed by this archive.

## v0.74.0 — Persisted recurrence and blocker evidence

- Expanded the organization-scoped workflow loader to derive recurrence counts from same-category, same-administrative-area signals observed within a 30-day window. This is a review prompt, not evidence of common causation.
- Included latest decision-stage records in workflow stage selection, surfaced explicitly blocked response actions, and counted recorded completion evidence as outcome evidence.
- Added workflow-loader tests for tenant scoping, mapped fields, rollback, and connection release.

## v0.73.0 — Authenticated Action Gap evaluation endpoint

- Added `POST /v1/action-gaps/evaluate`, using the authenticated actor and role checks rather than trusting an organization ID from request JSON.
- Added a bounded PostgreSQL workflow-case loader that scopes its query to the actor's organization and uses transaction-local organization context.
- Connects persisted signals, latest investigation/response action, evidence presence, and outcome presence to the versioned evaluator and idempotent Action Gap store.
- Findings are explicitly framed as workflow review prompts, not outbreak or causal determinations.
- Limitation: current relational schema does not persist every evaluator input (such as blocker declarations, handoff acceptance, and facility-match counts), so those advanced rules cannot be populated from this loader yet. Full dependency-backed tests and live PostgreSQL/RLS verification remain outstanding.

## v0.72.0 — Action Gap evaluation runner

- Added a runner that evaluates supplied workflow cases and persists findings through the existing tenant-scoped Action Gap store.
- Skips workflow cases outside the actor organization and reports created, replayed, and missing-signal outcomes separately.
- Added tests for tenant filtering, idempotent replay, and missing signal handling.
- The runner requires an authorized organization-scoped workflow query from its caller; route wiring and live PostgreSQL integration remain outstanding.

## v0.71.0 — Database-enforced Action Gap idempotency

- Added a nullable stable fingerprint and organization-scoped unique index for evaluator-generated detections.
- Repeated create requests return the existing detection without resetting review state or emitting a duplicate detection audit event.
- API response identifies replayed detections; migration and release-readiness tests cover the expanded migration chain.
- Full PostgreSQL concurrency integration remains to be run in CI.

## v0.70.0 — Action Gap reconciliation planner

- Added deterministic reconciliation planning with stable fingerprints based on signal, workflow case, rule code, and rule version.
- Added regression tests for idempotency, versioned fingerprints, changed findings, and duplicate inputs.
- Persistence transaction wiring and live PostgreSQL validation remain follow-up work.

## v0.69.0 — Versioned Action Gap evaluator core

- Added a backend TypeScript evaluator that emits deterministic, versioned findings from explicit workflow metadata, with explanations, evidence references, and recommended review steps.
- Added API-workspace tests for owner/blocker detection, cross-facility review wording, and the 48-hour verification threshold.
- This increment is the evaluator core only: automatic loading of persisted Action Graph records and idempotent persistence/reconciliation are still pending. It does not diagnose outbreaks or replace public-health review.
- Live PostgreSQL, full build, OIDC end-to-end, and the missing lockfile release gate remain unverified. Synthetic data only.

## v0.68.0 — Persisted Action Gap API

- Added authenticated, organization-scoped API endpoints to create and list persisted Action Gap detections and review them with optimistic status checks.
- Added PostgreSQL transactional storage with tenant context, signal ownership validation, and append-only audit events for detections and reviews.
- Added fail-closed 503 routes when the Action Gap store is not configured and included the store in readiness checks.
- Phase 2 remains in progress: detections are persisted via the API, but the synthetic detector has not yet been automatically wired to evaluate live graph data.

## v0.68.0 — Persisted Action Gap API

- Added authenticated, organization-scoped API endpoints to create and list persisted Action Gap detections and review them with optimistic status checks.
- Added PostgreSQL transactional storage with tenant context, signal ownership validation, and append-only audit events for detections and reviews.
- Added fail-closed 503 routes when the Action Gap store is not configured and included the store in readiness checks.
- Phase 2 remains in progress: detections are persisted via the API, but the synthetic detector has not yet been automatically wired to evaluate live graph data.

## v0.67.0 — Persisted Action Gap foundation

- Added organization-scoped, RLS-protected storage for auditable Action Gap detections, rule versions, supporting evidence, review status, and recommended next steps.
- Expanded the deterministic prototype rules for cross-facility patterns, recent recurrence, stalled hand-offs, and missing decisions/resources. These are workflow review prompts, not outbreak diagnoses.

## v0.66.0 — Schema-scoped outcome integrity checks

- Hardened the PostgreSQL outcome release gate so required constraints and indexes must exist on the intended `outcomes` table and in the active schema; similarly named objects in another schema can no longer satisfy the gate.
- Added a schema-specific diagnostic when an expected outcome index is missing.
- Bumped all workspace manifests to 0.66.0. The lockfile bootstrap, dependency-backed build, and actual PostgreSQL execution remain outstanding release gates; synthetic data only.

## v0.65.0 — Outcome database release gate

- Added a PostgreSQL CI verification script for outcome assessment columns, constraints, indexes, and tenant RLS policy.
- Wired the outcome database verification into CI and static release-readiness checks.
- Added regression coverage to prevent the database gate from silently disappearing.
- No migration changed in this increment; the migration checksum manifest is unchanged.

## v0.64.0 — Outcome backend integrity regression gates

- Added dependency-free regression checks for outcome API authentication/authorization, bounded list queries, UUID and payload validation, organization-scoped action-to-signal matching, transaction cleanup, audit/graph writes, strict evidence contract, migration metadata, and fail-closed behavior when storage is not configured.
- Kept outcome assessments separate from action completion; recorded outcome results are evidence to review, not automatic proof of causal impact or public-health effectiveness.
- Bumped all workspace manifests to 0.64.0. Package-lock generation and dependency-backed builds remain blocked in this environment because npm registry access timed out. No live PostgreSQL integration or production deployment is claimed; synthetic data only.

## v0.62.0 — Outcome assessment interface preview

- Added an outcome assessment form to the synthetic workflow workspace for indicator, baseline, target, follow-up measurement, result, evidence summary, and uncertainty.
- Displays the latest assessment beside the action record and adds a clearly labelled demo activity event.
- Validates key form requirements in the browser, including follow-up measurement for conclusive results and an uncertainty note for inconclusive results.
- Keeps this UI explicitly session-only; it does not yet authenticate to or persist through the API. The API endpoints introduced in 0.61.0 require integration with a real authenticated workspace and UUID-backed records before operational use.
- Updated all workspace versions to 0.62.0. Production build, PostgreSQL integration, and live deployment remain unverified; synthetic data only.

## v0.62.0 — Outcome assessment interface preview

- Added an outcome assessment form to the synthetic workflow workspace for indicator, baseline, target, follow-up measurement, result, evidence summary, and uncertainty.
- Displays the latest assessment beside the action record and adds a clearly labelled demo activity event.
- Validates key form requirements in the browser, including follow-up measurement for conclusive results and an uncertainty note for inconclusive results.
- Keeps this UI explicitly session-only; it does not yet authenticate to or persist through the API. The API endpoints introduced in 0.61.0 require integration with a real authenticated workspace and UUID-backed records before operational use.
- Updated all workspace versions to 0.62.0. Production build, PostgreSQL integration, and live deployment remain unverified; synthetic data only.

## v0.61.0 — Outcome evidence and accountability

- Extended outcome records with optional target values, explicit assessment results, evidence source, assessment method, and uncertainty notes while preserving compatibility with existing outcome rows.
- Added organization-scoped indexes to support action-linked and indicator-based follow-up review.
- Added a strict shared outcome-assessment validation contract requiring provenance and a stated result; qualitative/inconclusive assessments remain valid without numeric measurements.
- This increment defines the migration and shared contract; it does not claim that a new outcome API route or production database migration has been deployed.

## v0.60.0 — Workflow traceability prototype

- Added a session-only workflow activity timeline to demonstrate how response actions can be traceable. Explicitly labels the timeline as non-authoritative and not persisted to a server.
- Separated marking a response task complete from claiming an outcome has been verified. Completing a task does not automatically attach outcome evidence.
- Preserved synthetic-data-only positioning and human review requirements.
- Updated workspace versions to 0.60.0.


- Added a deterministic, transparent rule engine to flag unresolved workflow gaps: overdue verification, missing ownership, overdue actions, declared blockers, missing outcome evidence, recurrence, and limited/conflicting evidence. It returns reason codes and human-reviewable next-step suggestions; it does not diagnose disease or automatically confirm an event.
- Replaced the static landing-page preview with an interactive synthetic-data workspace showing prioritized cases, explainable gap scores, workflow facts, follow-up learning, and browser-local demo actions. UI clearly labels all records as synthetic and all demo changes as unsaved.
- Corrected the API manifest to use the published `@fastify/helmet` v12 range (`^12.0.1`); the previously declared `^12.1.0` cannot be resolved from npm.
- Added dependency-free regression tests for rule transparency, verification delays, ranking, missing outcome evidence, invalid inputs, and score bounds.
- This is an initial differentiating workflow prototype, not proof of uniqueness, clinical validity, deployed persistence, or operational effectiveness. `package-lock.json`, dependency-backed typecheck/build/audit, live PostgreSQL/RLS, OIDC integration, security/privacy review, and public-health governance validation remain release gates. Synthetic data only; not production-ready.

## v0.58.0 — Immutable GitHub Actions references

- Pinned every external action used by the repository workflows to a reviewed full-length commit SHA, retaining release labels in comments for maintenance.
- Added a dependency-free workflow verifier and regression tests that reject floating tags, branch names, and abbreviated commit hashes.
- Integrated action-pin verification into CI, the lockfile bootstrap workflow, and release-readiness checks.
- This hardens workflow supply-chain repeatability but does not replace dependency-backed CI, PostgreSQL/RLS, OIDC, deployment, or governance verification. `package-lock.json` remains a release blocker; synthetic data only; not production-ready.

## v0.57.0 — Fail-closed release readiness preflight

- Added a dependency-free release preflight that checks root/workspace version alignment, migration numbering and transaction wrappers, immutable migration checksums, the real npm lockfile and its manifest consistency, and required CI release gates.
- The preflight clearly reports the missing `package-lock.json` as a release blocker instead of treating static tests as production verification.
- Added regression tests for version drift, missing CI gates, migration integrity, and explicit lockfile-blocker reporting.
- This preflight is a local checklist, not a substitute for a successful networked `npm ci`, dependency-backed typecheck/build/audit, PostgreSQL/RLS execution, OIDC integration, deployment verification, or African-context governance review. Synthetic data only; not production-ready.

## v0.56.0 — Validate migration sequence before PostgreSQL integration

- The disposable PostgreSQL CI job now validates migration numbering, transaction wrappers, and destructive-DDL review gates before applying migrations.
- Keeps both sequence validation and SHA-256 drift verification ahead of any database changes, even when the PostgreSQL job is run independently of the quality job.
- Added regression coverage to enforce this ordering. This does not replace live PostgreSQL test results or a human review of migration SQL. The committed npm lockfile, dependency-backed build/typecheck/audit, OIDC integration, and governance gates remain open. Synthetic data only; not production-ready.

## v0.55.0 — Immutable migration checksum verification

- Added a SHA-256 manifest for the ten existing SQL migrations and a verifier that rejects malformed manifests, missing or unexpected files, duplicate entries, and changed migration contents.
- Added regression tests for successful verification, modified historical migrations, manifest/file drift, and malformed checksum entries.
- CI verifies checksums before applying SQL to disposable PostgreSQL; lockfile-bootstrap release validation also runs the check.
- This detects accidental migration-history edits but does not prove migrations are safe or that PostgreSQL integration passes. `package-lock.json`, networked build/audit, live PostgreSQL/RLS, OIDC, and governance checks remain release blockers. Synthetic data only; not production-ready.

## v0.54.0 — Workspace lockfile consistency verification

- Added a dependency-free verifier that compares npm lockfile v3 metadata against the root manifest and every declared workspace manifest.
- Verifies workspace presence, package names/versions, and declared dependencies/devDependencies/optionalDependencies to detect stale or mismatched lockfiles before installation and release checks.
- Integrated verification into lockfile bootstrap and normal CI; regression tests cover valid fixtures, unsupported lockfile versions, dependency drift, missing workspace entries/manifests, and workspace-list drift.
- The real lockfile is still missing from this local package; networked GitHub bootstrap and full dependency-backed checks remain required. Not production-ready.

## v0.53.0 — Lockfile artifact integrity and bounded CI execution

- Added SHA-256 generation and verification for the generated npm lockfile artifact before `npm ci`, reducing the chance of accidentally validating a mismatched or corrupted artifact.
- Added bounded job timeouts and per-ref workflow concurrency to avoid indefinitely running or overlapping lockfile bootstrap jobs.
- Extended dependency-free regression tests for checksum verification, timeouts, and concurrency configuration.
- The lockfile is still generated only on GitHub; this local environment has not generated or verified it. Review and commit the artifact, then rerun ordinary CI. Full PostgreSQL/RLS and OIDC validation remain release gates; synthetic data only; not production-ready.

## v0.52.0 — Networked lockfile bootstrap and release verification

- Added a manually triggered GitHub Actions workflow to generate a real npm v3 workspace lockfile in a network-enabled runner.
- The generated lockfile is uploaded as a short-lived artifact so it can be reviewed and committed; it is not silently committed or treated as production-ready.
- A second job downloads that exact artifact and validates it with `npm ci`, migration checks, engineering tests, typecheck, application tests, production build, and production dependency audit.
- Added dependency-free regression tests for the bootstrap workflow and preserved the normal CI gate requiring a committed lockfile.
- This environment still cannot generate a trustworthy lockfile without registry access. Production readiness remains blocked until the artifact is reviewed, committed, and the full CI/database/OIDC gates pass.

## v0.51.0 — Audit route runtime authorization and pagination tests

- Added runtime-level tests that execute the TypeScript audit route handler without installing application dependencies or pretending to be a full Fastify server test.
- Covered authentication and role checks, strict page-size rejection, default and maximum page sizes, fetch-one-extra pagination, continuation cursors, invalid-cursor rejection before store access, and storage-error propagation.
- These tests exercise the route handler directly with a controlled fake app/store; they do not replace end-to-end HTTP tests, live PostgreSQL/RLS/OIDC integration, dependency-backed CI/build/typecheck/audit, or the missing committed package lockfile. Synthetic data only; not production-ready.

## v0.50.0 — Strict audit query parameters and readiness completeness

- Hardened audit page-size parsing to reject repeated query parameters, arrays, signs, decimals, whitespace, leading-zero aliases, and values outside the supported 1–100 range instead of relying on JavaScript numeric coercion.
- Made the audit store part of API readiness: a service without audit retrieval configured now reports `not_ready`, and readiness output exposes the audit-store configuration state.
- Added regression tests for strict query validation and readiness dependency wiring. These source-level tests do not replace Fastify runtime tests, live PostgreSQL/RLS, OIDC integration, dependency-backed CI/build/typecheck/audit, or a committed package lockfile. Synthetic data only; not production-ready.

## v0.49.0 — Align persisted auditor membership with audit access policy

- Added migration `010_auditor_membership_role.sql` to explicitly permit the `auditor` organization-membership role used by the audit-read authorization policy.
- Updated OIDC actor-role validation so an active persisted auditor membership can resolve to a verified actor.
- Extended PostgreSQL integration fixtures to assert that an active auditor membership is accepted by the database policy.
- Added regression tests preventing drift between the persisted role constraint, OIDC resolver, and audit route authorization.
- This migration only permits the application role label; it does not grant PostgreSQL table privileges or replace tenant RLS.

## v0.48.0 — Least-privilege audit reader integration coverage

- Extended the disposable PostgreSQL RLS integration harness with a dedicated non-superuser audit-reader role granted SELECT only on the summary columns exposed by the audit endpoint. The role has no SELECT privilege on arbitrary JSON metadata.
- Added live-database assertions for the reader role's privilege posture, successful tenant-scoped reads, cross-tenant invisibility, and rejection of metadata access. Wired through the existing PostgreSQL CI job.
- The harness changes are covered by dependency-free regression tests, but this environment does not have a live PostgreSQL server, so SQL execution remains pending in CI. This is least-privilege test coverage, not proof of production readiness. package-lock.json and dependency-backed build/typecheck/audit plus OIDC verification remain release gates; synthetic data only.

## v0.47.0 — Reusable audit integrity posture verification

- Added a PostgreSQL verification script that fails closed if the audit table is missing, RLS is not enabled and forced, the tenant policy drifts, append-only UPDATE/DELETE or TRUNCATE guards are disabled/missing, the metadata-object constraint is unvalidated, or PUBLIC has table privileges.
- Wired the check into PostgreSQL CI after the tenant-isolation integration harness and added dependency-free regression tests for the verifier and CI wiring.
- This is an operational control-posture check, not a cryptographic hash chain or proof against a privileged database owner. Real PostgreSQL CI execution, full dependency-backed build/typecheck/audit, OIDC validation, and a committed package-lock remain release gates. Synthetic data only; not production-ready.

## v0.46.0 — Runtime tests for tenant-scoped audit persistence

- Added executable runtime tests for the PostgreSQL audit store using a controlled fake connection: verified-organization scope, keyset cursor parameters, deterministic ordering, bounded limit propagation, metadata-free projection, transaction commit, rollback after query failure, and connection release.
- These tests exercise adapter behavior without pretending to prove PostgreSQL row-level security. Live PostgreSQL/RLS/OIDC, dependency-backed typecheck/build, dependency audit, and a committed package-lock remain required release gates. Synthetic data only; not production-ready.

## v0.45.0 — Strict audit cursor validation

- Hardened audit pagination cursors with canonical base64url validation, an exact two-field payload allowlist, strict timestamp normalization, and PostgreSQL signed-bigint range checks. Malformed cursor values are rejected before they reach SQL, avoiding database errors from out-of-range IDs and ambiguous encodings.
- Added runtime tests against the TypeScript cursor codec for valid round trips, malformed encodings, extra payload fields, invalid dates, oversized cursors, and IDs beyond PostgreSQL bigint capacity.
- 69 dependency-free tests pass. This does not replace full dependency-backed CI/typecheck/build/audit or live PostgreSQL/RLS/OIDC validation. `package-lock.json` remains missing; synthetic data only; not production-ready.

## v0.44.0 — Tenant-scoped, metadata-free audit retrieval

- Added a read-only `GET /v1/audit-events` endpoint with explicit owner/administrator/reviewer/auditor authorization, bounded page sizes, and opaque timestamp-plus-ID cursors for stable pagination.
- Added a PostgreSQL audit store that sets organization scope transaction-locally, filters by the verified organization, and returns only an allowlisted summary projection. Arbitrary audit metadata is never returned by this endpoint, reducing the chance that operational history becomes a path for exposing health narratives or source details.
- Added fail-closed behavior when the audit service is not configured. The route still depends on correct OIDC membership resolution, database RLS, and least-privilege database grants.
- Dependency-free tests and static review only; live PostgreSQL/RLS, OIDC, full dependency-backed tests/typecheck/build/audit remain unverified. `package-lock.json` is still missing. Synthetic data only; not production-ready.

## v0.43.0 — Enforce audit metadata object shape

- Added a database constraint requiring `audit_events.metadata` to be a JSON object, preventing arrays and scalar values from entering the audit stream.
- Extended the PostgreSQL RLS/integration harness to verify the constraint is present and rejects an array payload.
- Added dependency-free regression checks for migration shape, integration-harness coverage, and object-shaped audit writes. The database test is authored but still needs execution against PostgreSQL; package-lock, full CI/build/audit, OIDC, and live RLS remain release gates. Synthetic data only; not production-ready.

## v0.42.0 — Make workflow audit versions explicit

- Investigation and response-action update events now record both `previousVersion` and resulting `version`, making each event easier to reconcile with optimistic concurrency checks.
- Added regression checks that both version values are recorded and that the audit write remains in the same transaction as the workflow update.
- Source-level checks only: live PostgreSQL/RLS, OIDC, full dependency-backed CI, production build, and dependency audit remain release gates. `package-lock.json` is still missing; synthetic data only; not production-ready.

## v0.41.0 — Guard audit metadata minimization

- Added regression tests across persistence stores to prevent raw health narratives, evidence text, investigation findings, source URIs, and credential-like fields from being copied into audit metadata.
- Verified source-level transactional ordering for audit inserts and commits, plus checks for categorical metadata and presence flags.
- These static checks do not replace runtime/database tests. `package-lock.json` remains missing; full dependency-backed CI, production build/audit, live PostgreSQL/RLS, and OIDC verification remain release gates. Synthetic data only; not production-ready.

## v0.40.0 — Enforce accountable response-action transitions

- Added an explicit response-action transition policy: `open` can move to `in_progress`, `blocked`, or `cancelled`; `in_progress` can move to `blocked`, `completed`, or `cancelled`; `blocked` can return to `in_progress` or move to `cancelled`.
- Reject skipped or reversed transitions and changes out of terminal `completed`/`cancelled` states as conflicts. Same-status edits remain allowed for due dates and completion metadata, and completion still requires evidence.
- Added executable dependency-free regression coverage for allowed, rejected, and same-state transitions. This does not replace full dependency-backed CI, live PostgreSQL/RLS, or OIDC verification. `package-lock.json` is still missing; synthetic data only; not production-ready.

## v0.39.0 — Exercise audit TRUNCATE protection in PostgreSQL integration checks

- Extended the disposable PostgreSQL/RLS integration harness to assert the enabled statement-level TRUNCATE trigger exists and to attempt TRUNCATE using a deliberately over-granted test role. The expected privilege-coded trigger rejection is checked and the seed audit row must remain intact.
- Kept production runtime privileges restrictive; the test-only role is intentionally over-granted solely to prove defense in depth.
- The harness change is source-reviewed and statically regression-tested here, but has not been executed against a live PostgreSQL server in this environment. Full dependency-backed CI, production build/audit, and OIDC integration remain release gates; package-lock.json is still missing. Synthetic data only; not production-ready.

## v0.38.0 — Block TRUNCATE against the audit log

- Added a statement-level `BEFORE TRUNCATE` trigger on `audit_events`, reusing the existing function that rejects audit mutations. This closes the gap where row-level UPDATE/DELETE triggers do not fire for TRUNCATE.
- Documented that trigger protection is defense in depth: the application runtime role must still lack TRUNCATE and DDL privileges.
- Added dependency-free regression guards for trigger wiring and migration transaction boundaries. Live PostgreSQL execution remains required.
- Full dependency-backed CI, production build/audit, live PostgreSQL/RLS tests, and OIDC integration remain release gates. `package-lock.json` is still missing; synthetic data only.

## v0.37.0 — Enforce same-signal Action Graph relationships

- Added database trigger enforcement so workflow relationships (`supports`, `contradicts`, `investigates`, `decides`, `triggers`, `implements`, `measures`, and `supersedes`) cannot accidentally connect nodes belonging to different signals within the same organization.
- Preserved `related_to` as the explicitly cross-signal relationship, keeping broader contextual links possible without weakening operational workflow integrity.
- Added dependency-free regression guards for all six graph node types and existing decision/action edge shapes. Live PostgreSQL execution is still required to validate trigger behavior.
- Full dependency-backed CI, production build/audit, live PostgreSQL/RLS tests, and OIDC integration remain release gates. `package-lock.json` is still missing; synthetic data only.

## v0.36.0 — Production connection-string policy hardening

- Expanded production database URL validation to reject `ssl` and PostgreSQL `options` parameters in addition to TLS certificate/mode overrides.
- Keeps TLS and session-level configuration under explicit service control; arbitrary connection-string session options can no longer silently alter settings such as `search_path`.
- Added regression coverage for uppercase and percent-encoded parameter names.
- Validation remains limited to dependency-free regression tests and migration-chain checks; full install, build, audit, and live PostgreSQL tests remain release gates.

## v0.35.0 — Normalize production TLS override detection

- Production PostgreSQL URL validation now detects TLS override parameters case-insensitively, including percent-encoded parameter names and parameters appearing alongside other query settings.
- Added regression tests for uppercase, mixed-case, encoded, and combined TLS override attempts.
- Full dependency install, typecheck, application tests, production build, dependency audit, and live PostgreSQL/RLS/OIDC integration remain release gates; the lockfile is still missing. Synthetic data only.

## v0.34.0 — Protect production PostgreSQL TLS configuration

- Production `DATABASE_URL` rejects `sslmode`, `sslcert`, `sslkey`, and `sslrootcert` query parameters because node-postgres connection-string SSL options can replace the explicit pool TLS options.
- Added regression coverage for disabled, weaker, and alternate certificate configuration attempts while preserving valid production URL behavior.
- Full dependency installation, typecheck, application tests, build, audit, and live PostgreSQL/RLS integration remain release gates. The lockfile is missing; synthetic data only.

## v0.33.0 — Strict decimal API port parsing

- Replaced permissive JavaScript numeric coercion for `API_PORT` with a dedicated parser that accepts decimal TCP port values only, defaults to `4000`, and rejects blank, whitespace-padded, scientific-notation, hexadecimal, fractional, and out-of-range inputs.
- Added dependency-free regression tests for defaults, valid boundaries, malformed values, and server wiring.
- This is configuration hardening, not a substitute for full dependency-backed CI, live PostgreSQL/RLS tests, or identity-provider integration. `package-lock.json` and full production verification remain release blockers; synthetic data only.

## v0.32.0 — Tighten production connection and issuer URL validation

- Require production PostgreSQL connection URLs to contain an explicit host and database name; reject fragments.
- Reject OIDC issuer URLs containing query strings or fragments, consistent with a stable issuer identifier.
- Added dependency-free regression tests for malformed-but-parseable database URLs and issuer URI components.
- Full dependency install, typecheck, application tests, production build, dependency audit, and live PostgreSQL/RLS integration remain release gates.

## v0.31.0 — Validate production database and OIDC configuration before startup

- Extended preflight validation to reject blank required settings, non-PostgreSQL database URLs, and non-HTTPS or credential-bearing OIDC issuer/JWKS URLs in production.
- Ensured production configuration is validated before creating the PostgreSQL pool, so invalid settings fail before external resources are allocated.
- Expanded dependency-free tests for blank values, URL schemes, embedded credentials, valid settings, non-production behaviour, and startup ordering.
- This is configuration validation, not live identity-provider or database verification. The missing lockfile, full dependency-backed typecheck/tests/build/audit and PostgreSQL/RLS integration remain release blockers. Synthetic data only; not production-ready.

## v0.30.0 — Validate production origin before resource allocation

- Added a focused production configuration validator for `WEB_ORIGIN`, requiring an explicit HTTPS origin with no path.
- Server startup runs this validation before constructing the PostgreSQL pool, avoiding unnecessary external resource allocation when the origin setting is missing or invalid.
- Added dependency-free regression tests for missing, malformed, HTTP, path-bearing, valid HTTPS, and non-production values, plus validation ordering.
- This does not replace full dependency-backed startup/build tests. `package-lock.json`, full application tests/typecheck/build/audit and live PostgreSQL/RLS integration remain release blockers. Not production-ready; synthetic data only.

## v0.29.0 — Bound PostgreSQL query execution time

- Configured both the PostgreSQL client's query timeout and the server-side statement timeout to five seconds, complementing the existing five-second connection timeout. This limits how long a stalled query can occupy a checked-out connection.
- Added a dependency-free regression test to guard all three timeout settings. The test checks source configuration; it does not simulate a live PostgreSQL stall.
- The missing npm lockfile, full dependency-backed typecheck/tests/build/audit and live PostgreSQL/RLS integration remain release blockers. Not production-ready; synthetic data only.

## v0.28.0 — Preserve readiness probe errors during connection cleanup

- Extracted the PostgreSQL connectivity probe into a small testable helper.
- Preserved the original `SELECT 1` failure when releasing the client also fails; standalone release failures remain visible.
- Added executable mock-client regression tests for success, primary-error precedence, and standalone cleanup failure.
- This tests client lifecycle behaviour without claiming live PostgreSQL verification. The missing lockfile, full application build/typecheck/audit and database integration remain release blockers.

## v0.27.0 — Preserve OIDC lookup errors during connection cleanup

- Hardened OIDC actor resolution so a connection-release failure cannot mask the original database or membership-resolution failure.
- Kept release failures visible when the membership lookup itself succeeded, avoiding silent pool-cleanup faults.
- Added focused regression tests for both error-precedence cases.
- Verification: dependency-free regression suite and migration-chain checks run in this environment; full Vitest/typecheck/build and PostgreSQL integration remain blocked by unavailable installed dependencies/database tooling. `package-lock.json` remains missing and must be generated on a networked machine before CI can pass.

## v0.26.0 — Correct fail-closed workflow service errors

- Fixed unconfigured decision/action endpoints that incorrectly returned the investigation service error, making operational diagnosis misleading.
- Added API integration coverage for the expected 503 responses and a dependency-free regression guard for route-to-error mapping.
- Full dependency installation, application test execution, production build, audit and live PostgreSQL verification remain outstanding.

## v0.25.0 — Preserve operation errors during connection cleanup

- Fixed decision/action store methods so a PostgreSQL connection-release failure cannot mask the original query/transaction failure.
- Connection-release failures are still surfaced when the operation itself succeeded, avoiding silent pool/connection cleanup errors.
- Added runtime regression tests for both error paths using a controlled mock connection and transpiled adapter.
- Dependency-free tests and migration-chain validation pass; full npm install/build/audit and live PostgreSQL integration remain outstanding.

## v0.24.0 — Runtime transaction-cleanup regression tests

- Added executable unit tests around the decision/action store's PostgreSQL transaction setup using a controlled mock connection, rather than relying only on source-pattern assertions.
- Verified `BEGIN` failures and tenant-scope setup failures trigger rollback attempts and release the checked-out connection.
- Verified rollback and release cleanup failures do not replace the original setup error.
- The runtime tests transpile the adapter with TypeScript and use no database or third-party runtime dependencies; they do not replace PostgreSQL integration tests.
- Full dependency installation, lockfile generation, full typechecking/build/audit, and live PostgreSQL integration remain release blockers.

## v0.23.0 — Preserve transaction setup errors during cleanup

- Hardened decision/action transaction setup cleanup so rollback or connection-release cleanup failures do not replace the original setup error.
- Added a dependency-free regression guard for error preservation.
- Tried generating the npm lockfile in offline mode; the required registry metadata is not cached, so no lockfile was fabricated. A networked release environment is still required.

## v0.22.0 — Transaction setup failure cleanup

- Prevented connection-pool leaks when PostgreSQL decision/action transaction setup fails before normal operation handling begins.
- On setup failure, attempt rollback, release the checked-out connection, and rethrow the original error.
- Added a dependency-free source regression test for this cleanup path.
- Validation remains limited by unavailable dependencies and PostgreSQL; this is not a production-ready release.

## v0.21.0 — RLS policy and PUBLIC-grant drift checks

- PostgreSQL security assertions now reject any unreviewed additional RLS policy on protected tables, including restrictive policies that could unexpectedly deny legitimate access.
- Added catalog checks to ensure protected tables do not grant table privileges to the `PUBLIC` pseudo-role, accounting for PostgreSQL default ACLs.
- Extended dependency-free harness tests to guard these assertions. These tests verify the presence of checks, not their behavior against a live database; PostgreSQL CI execution remains required.

## v0.20.0 — Cross-tenant visibility regression checks

- Added a data-level PostgreSQL RLS assertion that tenant-two rows remain invisible to a tenant-one runtime context across all nine tables with `organization_id`, including memberships, investigations, decisions, outcomes, actions, graph edges and audit events.
- Added a dependency-free source test to keep the cross-tenant assertions in the SQL harness.
- The new SQL integration assertion has not been executed against PostgreSQL in this environment; CI execution is still required.

## v0.19.0 — RLS policy broadening guardrails

- PostgreSQL RLS regression checks now reject extra permissive policies on protected tables, preventing a broad `USING (true)` policy from silently OR-broadening access beyond tenant isolation.
- Require the tenant policy to remain permissive with both `USING` and `WITH CHECK` tenant predicates.
- Require disposable integration roles to have no role memberships, blocking accidental inherited privileges and `SET ROLE` paths.
- Added dependency-free tests for the SQL harness's core security assertions. These tests validate test-source coverage only; PostgreSQL integration still must run in CI.

## v0.18.0 — Tenant policy completeness checks

- Extended PostgreSQL catalog assertions beyond RLS flags: every tenant table must have an enabled `tenant_isolation` policy with both `USING` and `WITH CHECK` expressions tied to `app.organization_id`.
- Added a guard against test roles inheriting superuser membership.
- These checks are part of the disposable PostgreSQL CI script but have not been executed in this environment; the missing npm lockfile and full application CI remain release blockers.

## v0.17.0 — Database security posture assertions

- Added catalog-level PostgreSQL integration assertions that all ten tenant tables have row-level security enabled and forced.
- Added checks that the append-only audit trigger exists and is enabled, and that both integration roles are non-superuser, non-BYPASSRLS roles without database/role creation privileges.
- These assertions run in the configured PostgreSQL CI job; they have not been executed in this environment. The npm lockfile and full application CI remain release blockers.

## v0.16.0 — Tenant-scope and audit-trigger regression coverage

- Extended the disposable PostgreSQL integration script to assert that tenant-protected rows are invisible when `app.organization_id` is unset.
- Added a separate deliberately over-privileged test role to verify the append-only audit trigger blocks `UPDATE` and `DELETE` even when SQL privileges are accidentally granted.
- These are CI-defined integration assertions; they have not been executed locally because PostgreSQL is unavailable here. The npm lockfile and full CI remain release blockers.

## v0.15.0 — Migration-validator hardening

- Reworked the SQL inspection pass to ignore comments and single-quoted string literals when checking for destructive `DROP TABLE`, `DROP SCHEMA`, or `DROP DATABASE` statements, reducing false positives.
- Kept quoted identifiers visible so destructive statements targeting quoted table names remain flagged.
- Tightened transaction-boundary checks so executable SQL after the final `COMMIT` is rejected.
- Expanded dependency-free migration-tool regression coverage from five to eight tests; all eight passed locally, and all six current migrations passed the checker.
- This checker is a lightweight guardrail, not a complete PostgreSQL parser or proof that migrations execute successfully. Lockfile, full application CI, and actual PostgreSQL execution remain outstanding.

## v0.14.0 — Migration-validator regression suite

- Refactored the migration-chain checker into a reusable validation function so it can be tested with isolated temporary fixtures.
- Added five dependency-free Node test cases covering valid sequential migrations, missing numbers, invalid names/transaction wrappers, destructive DDL, and empty directories.
- Added `npm run test:tools` and wired it into the root test command so validator regressions are checked before the application test suites.
- Local checks passed for all six current migrations and all five tool tests. This does not replace PostgreSQL execution or full application CI.

## v0.13.0 — Migration-chain verification

- Added a dependency-free migration-chain validator to enforce sequential, consistently named SQL migrations and explicit transaction boundaries.
- CI now validates the migration chain and applies every migration in lexical sequence instead of maintaining a duplicated hard-coded migration list.
- Added a destructive-DDL tripwire for table/schema/database drops so such changes receive explicit review.
- This improves migration coverage reliability but does not replace executing the migrations against PostgreSQL.

## v0.12.0 — Repeatable database regression checks

- Fixed the RLS integration script's audit seed cleanup: it previously attempted to delete an append-only audit row after the test transaction, which would cause the script to fail.
- Made audit and graph-edge fixtures safe to reuse across repeated runs.
- Added regression checks for cross-tenant moves of graph-referenced nodes and updates to missing graph endpoints.
- PostgreSQL execution is not available in this environment; this is a source-level test-harness fix, not a verified passing integration run.

## v0.11.0 — Graph node lifecycle integrity

- Added migration 006 to protect graph-referenced nodes against deletion or tenant/ID moves.
- Added row-level key-share locks during graph-edge endpoint validation to reduce check/delete races.
- Expanded PostgreSQL integration checks for same-tenant graph edges, missing and cross-tenant endpoints, and referenced-node deletion protection.
- Full CI remains unverified; lockfile, clean install, typecheck, tests, build, audit and live PostgreSQL checks remain release gates.

## v0.10.0 — Action Graph relationship integrity

- Added database-level same-signal foreign-key constraints across investigations, decisions, response actions, and outcomes.
- Expanded disposable PostgreSQL CI checks for decision/action RLS visibility and invalid cross-signal relationship rejection.
- Full CI remains unverified; lockfile and production-readiness gates remain open.

## v0.9.0 — Decisions and response actions

- Added decision and response-action validation contracts and tenant-scoped API endpoints.
- Added active-member ownership checks, same-signal relationship validation, immutable decision history, versioned action updates, completion-evidence requirement, graph edges, and transactional audit events.
- Added migration 003 for response-action optimistic concurrency and indexes; wired adapters and readiness reporting.
- Added schema contract tests and workflow documentation.
- Full dependency install, typecheck, tests, build, audit and live PostgreSQL integration remain unverified; lockfile is still required.

## v0.8.0 — Investigation workflow

- Added tenant-scoped create/list/update investigation API endpoints.
- Added owner membership validation, investigator ownership checks, optimistic versioning, transactional audit events, and terminal-state protection.
- Added migration 002 for investigation versions and CI migration application.
- Added shared request contracts and schema tests plus investigation workflow documentation.
- Verification remains incomplete until clean install, typecheck, tests, build, audit and PostgreSQL CI pass.

## v0.7.0 — Evidence provenance workflow

- Added strict evidence metadata validation, including HTTPS-only source references without embedded credentials. Source URLs are recorded but never fetched by the API.
- Added tenant-scoped evidence creation and listing endpoints linked to a signal, with role-based read/write access and generic not-found behaviour.
- Added a PostgreSQL evidence adapter that scopes transactions to the verified organization, uses the existing tenant RLS and same-transaction audit log, and avoids storing document contents or patient-level records.
- Added API tests for evidence metadata, HTTPS source validation and read-only role restrictions.

### Validation caveat

- Full dependency installation, lockfile generation, typechecking, tests, production build and live PostgreSQL integration remain unverified. Do not deploy this increment or use real health data until the lockfile is committed and CI passes. Evidence is metadata-only; it does not verify source authenticity or evidence quality.

## v0.6.0 — Audited signal lifecycle

- Added a constrained signal status-transition contract and role-aware transition authorization.
- Added `PATCH /v1/signals/:signalId/status` with UUID validation, optimistic concurrency via `expectedVersion`, and non-disclosing not-found responses for records outside the verified tenant.
- Added transactional PostgreSQL status updates and audit events; lifecycle updates increment the record version.
- Expanded the PostgreSQL integration script to verify a same-tenant status update and version increment.
- Updated least-privilege deployment guidance for narrowly scoped status/version/updated_at updates.
- Fixed the test store's replay comparison to exclude server-managed version metadata.

### Validation caveat

- Dependency installation and lockfile generation still time out in this environment. The v0.6.0 changes have not passed full TypeScript typechecking, unit tests, a production build, or live PostgreSQL integration. CI must pass before deployment; synthetic data only.

## v0.5.0 — Database isolation verification groundwork

- Added disposable PostgreSQL 16 CI coverage for migration application, tenant-scoped reads, cross-tenant write rejection, and append-only audit enforcement using a non-owner runtime role.
- Added a regression test for rollback and connection cleanup when the audit insert fails.
- Reduced CI token permissions to read-only and made the missing lockfile failure explicit.
- Full runtime verification remains pending until the lockfile is committed and CI is run; no production-readiness claim is made.

## v0.4.0

- Add OIDC token verification and active tenant-membership resolver.
- Add PostgreSQL pool adapter, readiness check, and graceful shutdown.
- Wire configured database and identity dependencies into API startup; production configuration fails closed.
- Add resolver tests and update engineering validation notes.
- Document minimum runtime DB grants and production verification gates; allow the explicit tenant selector header in CORS preflight.

## v0.3.0 — Signal workflow foundation

- Added authenticated-by-adapter signal create/list endpoints.
- Added PostgreSQL signal persistence adapter with transaction-local tenant scope and audit events.
- Added idempotent submission replay handling and changed-payload conflict detection.
- Added organization-scoped listing and least-privilege role checks.
- Added production `WEB_ORIGIN` configuration validation and HTTPS enforcement.
- Added route and persistence-adapter contract tests.

### Known limitations

- No production identity provider is configured.
- The default server does not connect a PostgreSQL driver or register the Postgres adapter.
- Migration and adapter have not been integration-tested against PostgreSQL.
- The npm lockfile is missing; reproducible installation and CI are not yet verified.
- Offline synchronisation, evidence/investigation/action endpoints, notifications, and outcomes workflow remain future milestones.
