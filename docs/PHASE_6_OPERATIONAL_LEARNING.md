# Phase 6 — Operational Learning

PubliPulse now provides a tenant-scoped operational-learning surface built from the Action Graph. It summarizes repeated workflow patterns without exposing individual records.

## What it measures

- signal volume and verified signals;
- completed response actions;
- recorded outcome assessments;
- improved and inconclusive outcome assessments;
- open action gaps;
- patterns by signal category and administrative area.

## Privacy posture

The API applies a configurable minimum signal-cell threshold (default 5). Small cells are suppressed from pattern output. The endpoint returns aggregates only and explicitly excludes individual records.

This is an implementation-learning capability, not an outbreak detector, clinical risk score, causal estimator, or programme-effectiveness claim.

## API

`GET /v1/learning/operational-patterns?days=90&minCell=5`

The endpoint is tenant-scoped from the authenticated actor and transaction-local PostgreSQL organization setting. It must not accept an organization identifier as a trusted source of authorization.

## Future African-wide learning

The current implementation deliberately stops at organization scope. A future federated learning layer can compare approved aggregate metrics across countries or programmes only after governance rules, common indicator definitions, disclosure controls, and data-sharing agreements are established. Cross-organization access must never be created by weakening tenant isolation.
