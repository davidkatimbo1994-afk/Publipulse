# PubliPulse Responsive UX — QA Checklist

Use with the v2 shell (`apps/web`). Mark each item after manual verification.

## Viewports

| Width | Layout expectation | Pass |
|-------|--------------------|------|
| 360px | Single column, bottom nav, no horizontal scroll | ☐ |
| 390px | Same as 360, readable filters | ☐ |
| 768px | Cards two-up where designed, drawer available | ☐ |
| 1024px | Desktop sidebar visible, bottom nav hidden | ☐ |
| 1440px | Multi-column dashboard split comfortable | ☐ |

## Navigation & keyboard

- [ ] Skip link focuses `#main-content`
- [ ] Sidebar / bottom nav move between all 10 areas
- [ ] Mobile menu opens/closes; Escape not required but backdrop click closes
- [ ] Report Signal and Assign Action modals open, submit, cancel
- [ ] Escape closes both modals
- [ ] Visible `:focus-visible` rings on buttons, inputs, nav items
- [ ] Tab order is logical (header → filters → content → primary actions)

## Role & offline

- [ ] Field Officer: Signals as cards; no Deploy Response table actions required
- [ ] Administrator: Signals as table with Deploy Response
- [ ] Offline chip shows text “Offline (N Queued)” not color alone
- [ ] Report while offline → appears in offline queue banner, not as server-saved
- [ ] Toggle back online with queued items → queue merges into signal list
- [ ] Advanced areas (Interop credentials) only needed for admin workflows

## Connected API (admin, optional live server)

- [ ] Credentials never appear in localStorage / IndexedDB after use
- [ ] Load connected workflow with valid token returns counts or clear error
- [ ] Weekly / learning / 7-1-7 buttons surface notices on failure
- [ ] With session credentials set, Report Signal attempts `POST /v1/signals` with shared intake shape (`clientSubmissionId` UUID, category, summary ≥ 10 chars)
- [ ] Failed live submit queues locally and states so in the notice

## Non-regression

- [ ] `apps/field` offline queue behaviour unchanged
- [ ] No API route or payload contract changes required by this UI pass
- [ ] Demo data still labelled as demonstration / session-only when not connected

## Build gates (when dependencies available)

```bash
npm run typecheck
npm run build -w @publipulse/web
npm run check:release-readiness   # if lockfile includes field
```

- [ ] Typecheck clean for web after `npm install`
- [ ] Production build succeeds
