# Pilot reconciliation boundary

PubliPulse treats reconciliation as evidence, not as proof of external-system success.

## Controlled flow

1. A verified upstream integration profile is selected.
2. An exchange request is created with an immutable contract fingerprint.
3. The authorized pilot adapter obtains the external result outside the core application.
4. The adapter submits only bounded reconciliation facts: external record count, optional external total, tolerance, and an optional evidence digest.
5. PubliPulse compares those facts with the local exchange envelope.
6. The resulting snapshot is append-only and tenant-scoped.
7. A mismatch remains a mismatch until an authorized operational process resolves it; PubliPulse never converts it to success automatically.

## Reconciliation states

- `exact`: record counts and totals match exactly.
- `within_tolerance`: record counts match and total difference is within the declared tolerance.
- `mismatch`: counts or totals differ beyond tolerance.
- `not_comparable`: counts match but comparable totals were not supplied.

## Pilot boundary

The endpoint records evidence supplied by an authorized adapter. It does not perform external transfer, authenticate to DHIS2, or claim that DHIS2 accepted a change. Credentials and raw health narratives are not stored in reconciliation evidence.

## Operational rule

A weekly district review may use reconciliation status to identify synchronization or mapping problems, but reconciliation status must not be interpreted as a clinical, epidemiological, or causal conclusion.
