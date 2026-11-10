# PubliPulse Responsive UX Architecture (Mature)

**Version:** 2.0  
**Status:** Implementation baseline  
**Non-negotiable:** Preserve API contracts, auth, tenant scope, offline queue, audit, migrations, and domain logic.

## Product goal

One coherent public-health platform for:

- **Field Officer (phone-first)** — report signals quickly, work offline, sync later, large touch targets.
- **Administrator / Analyst (desktop-first)** — hierarchy, tables, assignment, dashboards, governance.

Same backend, data model, permissions, offline semantics. Presentation adapts by role + viewport.

## Working areas

| ID | Label | Primary job |
|----|-------|-------------|
| dashboard | Dashboard | Situation overview + priorities |
| signals | Signals | Report, receive, review health signals |
| gaps | Action Gaps | Delayed / blocked responses |
| investigations | Investigations | Verify reported signals |
| actions | Response Actions | Assign and track work |
| outcomes | Outcomes | Evidence and results |
| weekly | Weekly Review | Governance sign-off |
| intelligence | Intelligence | Recurring problems |
| interop | Interoperability | External connections |
| settings | Settings | Org, offline, preferences |

## Front-end structure

```
apps/web/src/
├── main.tsx
├── App.tsx                 # shell + providers + area router
├── App.legacy.tsx          # previous monolithic command center
├── styles.css              # design tokens + responsive shell
├── context/AppContext.tsx
├── data/types.ts + fixtures.ts
├── components/ui/          # MetricCard, SeverityBadge
├── components/layout/      # AppShell, navConfig, Modals
├── areas/                  # one module per working area
└── lib/                    # existing queue, format, action-gap engine
```

## Principles

- Single adaptive shell (role + viewport)
- Role is UI preference only — server remains source of authorization
- Offline status always text + icon; queued items never look server-saved
- Design tokens on `:root` (medical-green system retained and extended)
- Accessibility: skip link, focus rings, labelled controls, reduced-motion
- API / auth / migrations / field offline queue unchanged

## Delivered this pass

- 10 working areas with titles, blurbs, primary actions
- Role switcher (Field Officer / Administrator)
- Online/offline toggle with local queue simulation
- Mobile bottom nav + drawer; desktop labelled sidebar
- Signal reporting and action assignment modals
- Role-adaptive Signals view (cards vs data table)
- Legacy App preserved as `App.legacy.tsx`

## Next steps

1. Re-attach connected API loaders from `App.legacy.tsx` under admin areas
2. Align fixtures with `@publipulse/shared` Signal schema
3. Viewport QA (360–1440) and keyboard pass
4. Optional: `packages/ui` shared primitives

See also `docs/RESPONSIVE-UX-REDESIGN.md` for acceptance checklist.
