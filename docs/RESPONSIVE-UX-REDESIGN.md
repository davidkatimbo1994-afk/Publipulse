# PubliPulse Responsive UX Redesign

## Objective

Deliver one coherent PubliPulse experience across phones, tablets and desktop browsers while retaining the existing API, authorization model, tenant boundaries, PostgreSQL schema, offline queue and domain workflows.

## Experience principles

- **Task first:** present the next useful action clearly; avoid exposing implementation details to field users.
- **One system:** web command center and Field app share the same visual language, status semantics and interaction conventions.
- **Responsive, not reduced:** desktop layouts use available space; phone layouts prioritize reading order, touch targets and focused tasks.
- **Offline is explicit:** connection and queued-work states remain visible; queued records are not represented as server-saved until synchronization succeeds.
- **Safe by default:** privacy guidance stays near field capture; no patient identifiers or precise household addresses should be entered.
- **Accessible:** visible keyboard focus, semantic navigation, readable contrast, reduced-motion support and labelled connection state.

## Navigation and page inventory

### Web command center

- Action overview (`#overview`)
- Action gaps (`#cases`)
- Signal-to-outcome workflow (`#workflow`)
- Outcome learning (`#learning`)
- Weekly review (`#weekly-review`)
- Effectiveness decay (`#decay`)
- Connected workspace (`#connect`)
- Field capture (`#field`)
- Evaluation and governance (`#evaluation`)
- Operational intelligence (`#operational-learning`)
- Recent activity (`#activity`)

Navigation remains labelled at all breakpoints. On compact screens it becomes a horizontally scrollable, touch-friendly section bar rather than an icon-only rail. Content sections retain anchor targets and scroll offset for the sticky navigation.

### Field workspace

- Capture a signal
- Queue an action update or outcome assessment
- Review queued work
- Configure and run synchronization

The Field app expands to a centered, readable desktop canvas and remains a single-column, thumb-friendly workflow on narrow phones. Connection state is announced as text, not only by color.

## Responsive breakpoints

- Wide desktop: full sidebar and multi-column analytical layouts.
- Compact desktop/tablet: labelled compact navigation and stacked detail panels where needed.
- Phone: sticky horizontal navigation, single-column forms, two-column summary tiles where space permits, and full-width primary actions.
- Very narrow phone: single-column workflow cards and no clipped labels.

## Interaction and visual standards

- Minimum 44px target height for primary navigation and actions.
- Consistent green primary action, neutral secondary action and clear warning/error states.
- Form labels remain visible; placeholders are examples, not substitutes for labels.
- Long identifiers and content must wrap or truncate without widening the viewport.
- Focus indicators are visible; reduced-motion preferences are respected.
- Mobile viewport uses safe-area insets.

## Non-regression requirements

Do not change API routes, request payloads, authentication token storage, organization scoping, offline queue persistence, idempotency keys, database migrations, audit behavior or role checks as part of this UX pass.

## Release acceptance checklist

- [ ] Web command center usable at 360px, 390px, 768px, 1024px and 1440px widths.
- [ ] Field capture usable at 360px, 390px, 768px and desktop widths.
- [ ] No horizontal page overflow at supported viewport widths.
- [ ] All web navigation anchors resolve to a real section.
- [ ] Navigation and controls usable by keyboard with visible focus.
- [ ] Field online/offline state includes text and is not color-only.
- [ ] Offline capture still queues locally and survives reload.
- [ ] Sync conflicts and rejected items remain visible and actionable.
- [ ] No credentials are persisted by the redesigned interface.
- [ ] API, migration, tenant isolation and audit tests remain green.
- [ ] Typecheck, tests, production build and dependency audit pass in CI.
