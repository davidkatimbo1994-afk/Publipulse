# PubliPulse Responsive UX v2 — Delivery Notes

This package includes the **mature responsive shell** for the web command center.

## What changed

- Modular architecture under `apps/web/src/` (context, layout, UI, areas)
- 10 working areas matching the product IA
- Role-adaptive UI (Field Officer cards / Administrator tables)
- Always-visible offline status + local queue simulation
- Design tokens and responsive shell CSS
- Previous monolithic UI kept as `apps/web/src/App.legacy.tsx`
- Architecture documented in `docs/RESPONSIVE-UX-ARCHITECTURE.md`

## What did not change

- API routes, payloads, authentication, tenant scoping
- PostgreSQL schema and migrations
- `apps/field` offline-first PWA
- `@publipulse/shared` domain contracts
- Security and audit behaviour

## How to run (after install)

```bash
npm install          # or npm run lockfile:refresh if lockfile needs apps/field
npm run dev:web      # API + web shell
```

Open the web app, use **Field Officer** vs **Administrator**, toggle **Online/Offline**, and navigate the 10 working areas.

Demo data is labelled as demonstration only.

## v2.1 — Connected API workspace (admin)

- Extracted memory-only API helpers to `apps/web/src/lib/api-client.ts`
  - `loadConnectedWorkflow`, `loadWeeklyReview`, `loadLearningSummary`, `loadSevenOneSeven`
  - Same endpoints and headers as `App.legacy.tsx`
  - Tokens never written to localStorage or IndexedDB
- New `areas/ConnectedWorkspace.tsx` — admin connection form + result panels
- Mounted under Administrator role on:
  - Outcomes
  - Weekly Review
  - Intelligence
  - Interoperability (full variant)
- Field Officer path remains free of API credential UI

## v2.2 — Shared schema alignment & a11y

- `data/domain-map.ts` maps presentation signals to `@publipulse/shared` SignalIntake / SignalStatus shapes
  - `toSharedStatus`, `inferCategory`, `toSignalIntakeDraft`
  - Summary length and location precision follow shared constraints
- Demo fixtures carry optional `sharedStatus` and `category` fields
- New signal reports set shared-aligned fields via domain-map
- Modals close on Escape
- Field Officer path still free of credential UI; admin Connected Workspace unchanged

### Mapping reference

| Presentation status | Shared SignalStatus |
|---------------------|---------------------|
| Under Investigation | investigating |
| Action Pending | under_review |
| Verified | verified |
| Response Active | investigating |
| Closed | closed |

## v2.3 — Live intake path + QA checklist

- `submitSignal` in `lib/api-client.ts` posts shared `SignalIntake` body to `POST /v1/signals`
- `AppContext` holds optional **session** API config (memory only)
- `ConnectedWorkspace` writes session config when fields are complete
- `reportSignal`:
  - Offline → local queue + explicit notice
  - Online + session credentials → live submit with `crypto.randomUUID()` clientSubmissionId; failure falls back to local queue
  - Online without credentials → demo session list only
- `docs/RESPONSIVE-UX-QA-CHECKLIST.md` for viewport, keyboard, offline, and API checks

## v2.4 — UI kit and honest data-mode labelling

- New `apps/web/src/ui-kit.css` (imported after `styles.css`) and `components/ui/`:
  `Button`, `EmptyState`, `Notice`, `DataModeBanner` (exported from `components/ui/index.ts`).
- `DataModeBanner` renders on every working area and says in words whether the page shows
  **Demonstration data** or a **Live session**, and which parts of the area are actually live
  (`AREA_LIVE_SUPPORT` in `navConfig.ts`). The top-bar badge follows the same state.
- About 110 inline `style={{…}}` props in `areas/` and `AppShell` replaced with shared classes
  (≈50 bespoke or dynamic ones remain). Inline text below 12px raised to 12px; v2 CSS text floor
  raised (10→11px, 11→12px). 44px touch targets on coarse pointers.
- **Bug fixes found in the v2.3 baseline**
  - `AppContext` did not expose `sessionApiConfig`, `setSessionApiConfig`, `lastSubmitNotice` or
    `setLastSubmitNotice`; `ConnectedWorkspace` would have thrown on first input and live submit
    could never trigger.
  - `SignalsView` read `lastSubmitNotice` without destructuring it from `useApp()`.
  - `HealthSignal` lacked the optional `sharedStatus` / `category` fields the fixtures and
    `reportSignal` already set.
  - `createAction` type required `signalId` although the modal does not supply it.
- API routes, payloads, auth, offline queue and migrations untouched.

### Verification status
Syntax and type check run with dependencies unavailable (no `node_modules`, no network): no syntax
errors; no type errors beyond missing-module resolution. **Not yet run:** `npm install`,
`npm run typecheck`, tests, production build, browser/viewport QA.

## v2.5 — Signals redesign and stepped report flow

- `components/signals/SignalIntakeWizard.tsx` replaces the single-page "Report Health Signal Intake" modal
  (removed from `Modals.tsx`). Three steps: What (disease, severity as large radio choices) →
  Where & how many (location, cases, deaths, privacy reminder) → Review (notes, summary, destination).
  - Per-step validation with a text error; Back/Next; Enter advances, final step submits.
  - Bottom sheet on phones, centred dialog on desktop; Escape and backdrop close; focus moves to the first field.
  - Review step states where the report goes: server, this device (offline) or browser-session demo.
  - Still submits via `reportSignal` with the same payload; API and offline behaviour unchanged.
- `areas/SignalsView.tsx`: distinct empty states (no signals vs. filters hide everything, with "Clear filters"),
  offline queue shown as text ("Pending sync"), labelled table with column scopes and keyboard-focusable scroll region,
  plain-language labels ("Assign response").
- Pending: Dashboard, Action Gaps and Response Actions redesign; Field app token alignment; dead legacy CSS removal.

### QA additions
- [ ] Report flow: complete all 3 steps at 360px and 1440px; Back keeps entered values
- [ ] Step 1 and 2 show an error and do not advance when required fields are empty
- [ ] Offline: review step reads "Save to device"; queued item shows "Pending sync"
- [ ] Screen reader announces "Step N of 3" and validation errors

## v2.6 — Dashboard, Action Gaps and Response Actions

- New `data/derive.ts` (priority ordering, gap/SLA wording, overdue check). Checked with a quick node run.
- **Dashboard** is now driven by the data instead of fixed text:
  - Removed hard-coded "Bundibugyo" alert and the fixed "94.2% response rate" tile; the alert banner shows the
    most urgent open Critical signal, and tiles show open signals, gaps, actions in progress and closed signals.
  - Priority signals list excludes closed signals and sorts by severity then recency; empty states added.
  - Field Officers get a "Report a signal" card with offline-queue count at the top.
  - Fixed "+-6.0h overdue" shown for at-risk gaps; wording is now "Late/At risk: N h over target / N h left".
- **Action Gaps** (`areas/ActionGapsView.tsx`): sorted by urgency, plain-language fields, and the escalate button now
  works in-session (`escalateGap` in context; shows an "Escalated" notice). Demonstration state only, not sent to the API.
- **Response Actions** (`areas/ResponseActionsView.tsx`): grouped Not started / In progress / Completed, overdue flag in
  text, labelled "Mark complete"/"Reopen" buttons, empty state.
- `ActionGapsView` and `ResponseActionsView` moved out of `OtherAreas.tsx`.
- Investigations "Open Field Form" is now a working session-only checklist (see CHANGELOG). Outcomes/Weekly/Intelligence/
  Interoperability/Settings still use the older layout.

### QA additions
- [ ] Dashboard: closing/reopening data changes tiles; no critical open signal → no red banner
- [ ] Gaps: escalate once → shows "Escalated", button disappears
- [ ] Actions: mark complete moves item to Completed group; overdue shows text, not colour only


## v2.8 – v2.10 — Charts, live API charts, working buttons

**Charts**
- Dashboard: epidemic curve (DEMO), open signals by severity (live app state), response time vs target (live app state)
- Outcomes: weekly time-to-detect / time-to-respond trends (DEMO)
- Signals: "Download CSV" for the rows shown
- Connected Workspace (admin, after connecting): weekly-review district funnel and 7-1-7 clocks (LIVE API)
- Demo charts carry a "Demonstration data" badge. No endpoint yet returns daily/weekly history.

**Buttons fixed**
- Investigations "Open field form": session-only step checklist; progress bar follows the ticks
- Outcomes "Export Report": downloads outcomes-report.csv
- Weekly Review "Sign-off Week 44 Log": session-only sign-off, administrators only (not recorded on the server)
- Connected Workspace: hint explains why buttons are greyed out until credentials are entered
- `scripts/check-no-dead-buttons.test.mjs` keeps it that way

**Verification (this environment, no network)**
- `node --test scripts/*.test.mjs`: 257 of 257 pass
- `check:sql`, `check-migration-chain`, `check-migration-checksums`: pass
- Web and field `.tsx` typechecked strict (noUnusedLocals/Parameters) against a stand-in for the React types: no errors in the new or changed code
- NOT run: `npm install`, `npm run typecheck`/`build` with real React types, `npm run test:db`, shared/api package tests (dependencies not installable offline)
- `check:release-readiness` still reports BLOCKED: `package-lock.json` is missing from this package. Run `npm run lockfile:refresh` on a networked machine.

**QA to add**
- [ ] Investigations: open form, untick a step, progress drops; Hide closes the panel
- [ ] Outcomes: Export Report downloads a CSV with 3 metrics, 2 evidence rows and a demonstration note
- [ ] Weekly Review: as Field Officer no sign-off button; as Administrator sign-off shows a status chip
- [ ] Connected Workspace: before entering credentials the hint is visible; after, buttons enable
- [ ] Charts: each "View as table" opens; "Download CSV" works; phone width shows no sideways page scroll


## v2.11 — Remaining areas, Settings and field alignment

- Investigations: search, progress filter, summary tiles, accessible progress bar, step checklist per signal.
- Outcomes: headline results (first three marked demonstration), charts, **Record evidence** form and evidence log (session only, no invented hash), CSV export includes session evidence.
- Weekly Review: summary computed from current signals/gaps/actions, decisions list, add-decision form and confirmed sign-off (administrators; session only).
- Intelligence: owner/area breach counts and review questions derived from Action Gaps; causes table.
- Interoperability: status summary, "Need attention" filter, status as text chips, administrator-only pause/resume (display only).
- Settings: Account and organisation; Team and permissions (administrators; demonstration, not saved); Offline and sync.
- Field app: brand mark and phone bottom navigation bar.
- Still demonstration-only: users, evidence, decisions, sign-off, connector pause/resume. Wiring these to API endpoints is the next step.
- Verification: see CHANGELOG. Browser QA still to do (use `docs/RESPONSIVE-UX-QA-CHECKLIST.md`).
