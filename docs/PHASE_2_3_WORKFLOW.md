# Phase 2–3 workflow completion

## Product workflow

PubliPulse now presents one continuous workflow:

`Signal → Investigation → Decision → Response → Outcome`

The Action Gap Engine sits across that workflow and identifies workflow conditions that need human review. It does not diagnose disease, declare outbreaks, infer causation, or replace public-health governance.

## Connected workspace

The web client can load an authorized signal by UUID and retrieve:

- signal record
- linked evidence
- investigations
- decisions
- response actions
- persisted outcome assessments
- tenant-scoped action gaps
- action-handoff events for the selected response action

The UI deliberately keeps the bearer token in component memory. It does not use localStorage or sessionStorage for credentials.

## Outcome learning

An outcome assessment requires an indicator and evidence summary. The shared contract also supports baseline, target and follow-up measurements and requires uncertainty for inconclusive results. A response action being completed is never treated as proof of impact.

## Accountable handoffs

Response-action handoffs use an append-only event sequence (`initiated`, `accepted`, `declined`, `cancelled`). The API checks active membership, transition validity and actor permissions, and writes an audit event in the same transaction as the handoff event.

## Remaining release work

These phases are product/engineering completion work, not a production authorization. The release gates still require a committed verified `package-lock.json`, dependency audit review, live PostgreSQL/RLS integration using a non-owner runtime role, OIDC end-to-end verification, operational controls, privacy/governance approval and deployment evidence.
