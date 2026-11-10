# Decisions and response actions

This API milestone records decisions and response tasks; it does not autonomously determine public-health policy or declare an outbreak. Use authorised human review and the organisation’s established escalation procedures.

## Endpoints

- `POST /v1/signals/:signalId/decisions` — owner, administrator, or reviewer creates an immutable decision record.
- `GET /v1/signals/:signalId/decisions` — authorised organisational roles read decision history.
- `POST /v1/signals/:signalId/actions` — owner, administrator, reviewer, or responder creates a response task and assigns it to an active organisation member.
- `GET /v1/signals/:signalId/actions` — authorised organisational roles list tasks.
- `PATCH /v1/actions/:actionId` — authorised manager or assigned responder/investigator updates an action using `expectedVersion`.

## Integrity rules

- Decisions must reference an existing signal; an optional investigation must belong to that same signal and organisation.
- An action's optional decision must belong to the same signal and organisation; its owner must be an active organisation member.
- Completion requires completion evidence. Completed and cancelled actions are terminal in this increment.
- Updates are optimistic-concurrency protected; stale versions return HTTP 409.
- Creation/update and audit events are committed in the same transaction. Signal/decision-to-action graph edges preserve the action chain.
- Runtime DB grants should remain least-privilege; RLS tenant scope is derived from verified identity and membership.

The migration, API and tests still require full execution in CI against PostgreSQL before production use. Continue with synthetic data until security, privacy and public-health governance gates are approved.
