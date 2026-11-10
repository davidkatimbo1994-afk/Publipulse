# PubliPulse Pilot Closeout and Acceptance Gate

## Purpose

This document defines when the PubliPulse outcome/accountability overlay can be considered ready for a controlled field pilot. It does not authorize use of real health data by itself.

## Pilot boundary

The upstream surveillance/event-management system remains the detection and source-of-record layer. PubliPulse receives only the approved event/signal fields required for the pilot and owns the downstream accountability workflow: ownership, action, handoff, outcome evidence, recurrence, blockers and bounded operational learning.

PubliPulse must not become a parallel national case master, clinical decision-support system, media-monitoring system, or generic BI platform.

## Required pilot evidence

1. Approved organization, purpose, data inventory and retention rules.
2. One named upstream system and documented mapping/version.
3. Staging exchange test with authentication, provenance, idempotency and reconciliation evidence.
4. PostgreSQL RLS execution evidence using a non-owner runtime role.
5. OIDC staging evidence and privileged-role review.
6. Backup and restore evidence.
7. Offline action/outcome replay and conflict test evidence.
8. Reporter-feedback transport verification, or an explicit pilot decision to operate without outbound transport.
9. District weekly review artifacts for the defined pilot period.
10. Immutable pilot evidence records containing baseline/pilot definitions and operational incidents.
11. Weekly human decisions with next-check dates and append-only follow-up.
12. Final descriptive comparison using compatible denominators and documented cohort boundaries.

## Acceptance criteria

The pilot is acceptable only if:

- no cross-tenant read/write is demonstrated;
- no silent duplicate is produced by a retried mutation;
- no silent overwrite occurs after an offline conflict;
- unresolved and unmeasured outcomes remain visible;
- durability is not declared before its observation window completes;
- reconciliation mismatches are visible rather than silently repaired;
- privacy/security incidents are recorded and reviewed;
- weekly decisions are traceable to the evidence reviewed;
- every external integration claim is backed by an executed test or deployment record.

## Interpretation

Pilot comparisons are descriptive implementation evidence. They do not establish causation, clinical effectiveness, outbreak control, or superiority over an existing health-system tool without an appropriate comparative design.

## Production gate

A controlled pilot is not the same as production readiness. Before approved real health data is used, the release gates must include a committed lockfile, clean `npm ci`, typecheck, tests, production build, dependency audit, runtime PostgreSQL/RLS evidence, OIDC evidence, deployment security, backup/restore, data lifecycle enforcement, incident response, and the pilot organization's governance/privacy approval.
