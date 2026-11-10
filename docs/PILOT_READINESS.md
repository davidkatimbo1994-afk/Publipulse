# Pilot readiness: what must be true, and how success is judged

PubliPulse's purpose is a response that moves from signal to verified action to a recorded outcome, and learns from it. A working build does not show that. A supervised pilot with one organisation does. This page lists what must be closed first and the measures to agree **before** the pilot starts, so success is not decided afterwards.

## Gates to close first (evidence, not code)
Owner and date for each, kept in `docs/RELEASE_GATES.md`.
1. Clean `npm ci`, typecheck, production build and the full test suite on a clean machine.
2. PostgreSQL integration tests on the target database version, including migrations 037 to 041, row-level security and the append-only triggers.
3. Real identity provider in staging: sign-in, the organisation header, invitation redemption, a suspended user rejected.
4. Browser check of the screens on a phone and a desktop, including with a screen reader on the new tables.
5. Gateway test in staging: a real USSD code and SMS short code (needs operator approval), the shared secret, the callback format, and the actual character limit per USSD screen on that operator.
6. Privacy impact assessment, retention approval, security assessment and public-health governance sign-off for the pilot country. Local-language wording for consent and menus, approved by the public health team.
7. Production database grants as listed in `docs/DEPLOYMENT_SECURITY.md`, with no INSERT on `organizations` for the runtime role.

## Measures to agree before starting
Pick targets with the organisation; the system cannot choose them. "In system" says where the figure comes from today; anything marked "derive" is not shown on a screen yet and would be read from the records.

| Measure | Why it matters | In system |
|---|---|---|
| Share of verified signals that reach a recorded outcome assessment within an agreed time | The core claim: the loop closes | Outcomes screen and records; the share itself is derive |
| Median time from signal to first accountable action | Where responses stall | 7-1-7 clocks exist; the median is derive |
| Share of actions with a named owner and a due date | Accountability | derive |
| Community reports: median hours from receipt to decision, and the oldest waiting | Whether the new channel is handled, not ignored | Community reports page (built) |
| Share of community reports that become signals, and reasons for dismissal | Whether the channel carries real information or noise | Community reports page lists decisions; the share is derive |
| Actual cost per improved assessment, by action type | Where money helped, as a description only | Costs page (built); not cost per life saved |
| Stock series flagged critical or warning, and whether a signal or action followed | Whether the forecast changes behaviour | Stock page (built); follow-up is derive |
| Reviewer and user comments on what was confusing or missing | The things numbers miss | Collect by interview |

## How to read the results
- A pilot of one organisation shows whether the workflow is usable and whether the loop closes there. It does not show that outcomes improved because of PubliPulse.
- Outcome and cost figures describe; they do not prove cause. Context data shows association in time only.
- Decide in advance what result would make you stop or change course (for example, the community queue never being triaged within 72 hours).
