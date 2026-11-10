# API reference

Generated from route registrations in `apps/api/src`. All `/v1` routes require `Authorization: Bearer <OIDC access token>` and an `x-organization-id` header (a selector only; tenant and role come from database membership). Routes fail closed when their identity or persistence adapter is not configured. `Role gate` is the permission helper the handler calls; some handlers also apply an inline role list (for example `PATCH /v1/actions/:actionId`), and the authoritative role lists live in the route and store source. `GET /v1/audit-events` answers 503 `audit_service_not_configured` until the audit store is wired.

| Method | Path | Role gate | Extra headers | Source |
|---|---|---|---|---|
| GET | `/health/live` | public | — | `app.ts` |
| GET | `/health/ready` | public | — | `app.ts` |
| PATCH | `/v1/action-gaps/:id/review` | `canReviewGaps` | — | `action-gap-routes.ts` |
| POST | `/v1/action-gaps/evaluate` | `canCreateGap` | — | `action-gap-routes.ts` |
| GET | `/v1/action-gaps` | `canReadGaps` | — | `action-gap-routes.ts` |
| POST | `/v1/action-gaps` | `canCreateGap` | — | `action-gap-routes.ts` |
| GET | `/v1/actions/:actionId/handoffs` | `canManageHandoffs` | — | `action-handoff-routes.ts` |
| POST | `/v1/actions/:actionId/handoffs` | `canManageHandoffs` | — | `action-handoff-routes.ts` |
| PATCH | `/v1/actions/:actionId` | `canReadDecisionsActions` | — | `decision-action-routes.ts` |
| GET | `/v1/audit-events` | `canReadAudit` | — | `audit-routes.ts` |
| GET | `/v1/governance/sharing-policies` | `canReadInteroperability` | — | `interoperability-routes.ts` |
| POST | `/v1/governance/sharing-policies` | `canManageSharingPolicy` | — | `interoperability-routes.ts` |
| GET | `/v1/interoperability/countries` | authenticated | — | `interoperability-routes.ts` |
| POST | `/v1/interoperability/exchange-requests` | `canReadInteroperability` | `Idempotency-Key` | `interoperability-routes.ts` |
| GET | `/v1/interoperability/indicators` | authenticated | — | `interoperability-routes.ts` |
| GET | `/v1/interoperability/integration-profiles` | `canReadInteroperability` | — | `interoperability-routes.ts` |
| GET | `/v1/interoperability/programmes` | `canReadInteroperability` | — | `interoperability-routes.ts` |
| POST | `/v1/interoperability/reconciliation-snapshots` | `canReadInteroperability` | — | `interoperability-routes.ts` |
| POST | `/v1/interoperability/upstream/dhis2/events` | `canIngest`, `canReadInteroperability` | — | `upstream-event-routes.ts` |
| PATCH | `/v1/investigations/:investigationId` | authenticated | — | `investigation-routes.ts` |
| GET | `/v1/learning/7-1-7` | `canReadOperationalLearning` | — | `learning-routes.ts` |
| GET | `/v1/learning/operational-patterns` | `canReadOperationalLearning` | — | `learning-routes.ts` |
| GET | `/v1/learning/outcome-decay` | `canReadOperationalLearning` | — | `learning-routes.ts` |
| GET | `/v1/learning/persistent-problems` | `canReadOperationalLearning` | — | `learning-routes.ts` |
| GET | `/v1/learning/pilot-comparison` | `canReadOperationalLearning` | — | `learning-routes.ts` |
| POST | `/v1/learning/pilot-evidence` | `canReadOperationalLearning` | — | `learning-routes.ts` |
| POST | `/v1/learning/weekly-decision` | `canRecordWeeklyDecision` | — | `learning-routes.ts` |
| GET | `/v1/learning/weekly-review` | `canReadOperationalLearning` | — | `learning-routes.ts` |
| GET | `/v1/signals/:signalId/actions` | `canReadDecisionsActions` | — | `decision-action-routes.ts` |
| POST | `/v1/signals/:signalId/actions` | `canCreateResponseActions` | — | `decision-action-routes.ts` |
| GET | `/v1/signals/:signalId/decisions` | `canReadDecisionsActions` | — | `decision-action-routes.ts` |
| POST | `/v1/signals/:signalId/decisions` | `canManageDecisions` | — | `decision-action-routes.ts` |
| GET | `/v1/signals/:signalId/evidence` | `canReadEvidence` | — | `evidence-routes.ts` |
| POST | `/v1/signals/:signalId/evidence` | `canManageEvidence` | — | `evidence-routes.ts` |
| GET | `/v1/signals/:signalId/investigations` | `canReadInvestigations` | — | `investigation-routes.ts` |
| POST | `/v1/signals/:signalId/investigations` | `canCreateInvestigation` | — | `investigation-routes.ts` |
| POST | `/v1/signals/:signalId/milestones/:milestone` | authenticated | — | `signal-routes.ts` |
| GET | `/v1/signals/:signalId/outcomes` | `canReadOutcomeAssessments` | — | `outcome-routes.ts` |
| POST | `/v1/signals/:signalId/outcomes` | `canCreateOutcomeAssessment` | `x-client-mutation-id` | `outcome-routes.ts` |
| GET | `/v1/actions/:actionId/costs` | `canReadActionCosts` | — | `action-cost-routes.ts` |
| POST | `/v1/actions/:actionId/costs` | `canRecordActionCost` | `x-client-mutation-id` | `action-cost-routes.ts` |
| GET | `/v1/costs/summary` | `canReadActionCosts` | — | `action-cost-routes.ts` |
| POST | `/v1/stock/snapshots` | `canRecordStock` | `x-client-mutation-id` | `stock-routes.ts` |
| GET | `/v1/stock/forecast` | `canReadStock` | — | `stock-routes.ts` |
| POST | `/v1/context/observations` | `canRecordContext` | `x-client-mutation-id` | `context-routes.ts` |
| GET | `/v1/context/observations` | `canReadContext` | — | `context-routes.ts` |
| GET | `/v1/members` | owner, administrator | — | `membership-routes.ts` |
| PATCH | `/v1/members/:userId` | owner, administrator (see `docs/ORGANISATION_ONBOARDING.md` for who may change whom) | — | `membership-routes.ts` |
| POST | `/v1/invitations` | owner, administrator | — | `membership-routes.ts` |
| GET | `/v1/invitations` | owner, administrator | — | `membership-routes.ts` |
| POST | `/v1/invitations/:invitationId/revoke` | owner, administrator | — | `membership-routes.ts` |
| POST | `/v1/invitations/redeem` | any signed-in person with a valid code (no membership needed); rate limited | — | `membership-routes.ts` |
| POST | `/inbound/community/ussd` | gateway shared secret in `x-intake-secret` (no bearer token); form-encoded; 503 until configured | — | `community-intake-routes.ts` |
| POST | `/inbound/community/sms` | gateway shared secret in `x-intake-secret` (no bearer token); form-encoded; 503 until configured | — | `community-intake-routes.ts` |
| GET | `/v1/community-intake/queue` | owner, administrator, reviewer | — | `community-intake-routes.ts` |
| GET | `/v1/community-intake/stats` | owner, administrator, reviewer | — | `community-intake-routes.ts` |
| POST | `/v1/community-intake/:submissionId/review` | owner, administrator, reviewer | — | `community-intake-routes.ts` |
| GET | `/v1/signals/:signalId/context` | `canReadContext` | — | `context-routes.ts` |
| POST | `/v1/signals/:signalId/reporter-feedback` | `canManageReporterFeedback` | `x-client-mutation-id` | `reporter-feedback-routes.ts` |
| PATCH | `/v1/signals/:signalId/status` | `canTransitionSignal` | — | `signal-routes.ts` |
| GET | `/v1/signals` | authenticated | — | `signal-routes.ts` |
| POST | `/v1/signals` | `canSubmitSignals` | — | `signal-routes.ts` |

List endpoints take a strict decimal `limit` query parameter; invalid values return 400 `invalid_limit`. Responses carry `requestId`.

This table was generated from the route registrations; update it in the same change as any route change.
