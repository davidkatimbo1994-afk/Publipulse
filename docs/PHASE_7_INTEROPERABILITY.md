# Phase 7 — African-scale interoperability & governance

PubliPulse interoperability is designed to let an African public-health deployment exchange standardized, governed information with external health-information systems without making interoperability the product's purpose.

## Completed groundwork

1. **Country configuration** — country code, language, timezone and administrative-level definitions.
2. **Programme configuration** — country-scoped programmes with lifecycle state.
3. **Standard indicator registry** — stable indicator identity, definitions, units, aggregation and standard/version metadata.
4. **Country indicator mappings** — local indicator codes and labels with explicit mapping versions.
5. **Administrative-unit mappings** — country/level/local-code to external-code mappings with versions.
6. **Data-sharing boundaries** — classification, destination, permitted indicators, minimum-cell-size suppression and explicit cross-border permission.
7. **Integration profiles** — provider metadata and capability declarations for DHIS2, FHIR, CSV and other providers. Profiles never store credentials or tokens.
8. **Versioned exchange contracts** — direction, mode, country/programme, indicator set, mapping versions, purpose and boundary flags.
9. **Idempotent exchange state** — job status, retry state, idempotency key and contract fingerprint.
10. **Receipts and provenance** — provider receipt, payload/response evidence and append-only provenance stages.
11. **Reconciliation** — conservative comparison of local/external record counts and totals; missing totals are not treated as zero.
12. **DHIS2 metadata reconciliation** — versioned indicator and organisation-unit mappings with metadata-drift detection.
13. **Controlled DHIS2 test harness** — deterministic in-memory metadata/data-value exchange with test-only credentials and no network client.
14. **Provider-neutral exchange envelope** — a versioned evidence envelope that can carry DHIS2 data-value sets, FHIR-style bundles or offline CSV aggregate exchange.
15. **Offline CSV boundary** — deterministic UTF-8 aggregate representation suitable for controlled low-connectivity workflows.
16. **Minimum-cell suppression** — suppressed values become explicit `null`, never zero, so suppression cannot be mistaken for absence of cases.

## Hard boundary

Phase 7 does **not** claim a live DHIS2 or FHIR integration. A verified production provider adapter, real credentials, controlled test environment, network security review, and end-to-end PostgreSQL/RLS verification are still required before external transfer is enabled.

The current controlled DHIS2 harness is deliberately in-memory and contains no `fetch`, Axios, or other network transport.

## Exchange lifecycle

`contract → tenant/policy authorization → mapping validation → metadata validation → privacy boundary → provider-neutral envelope → provider adapter → external receipt → provenance → reconciliation`

Any failed prerequisite must fail closed. A configuration record, approved mapping, successful local validation, or queued job is never itself treated as proof that an external health-system transfer occurred.

## African-scale design principle

The interoperability model is country-aware and provider-neutral. DHIS2 is one possible adapter; FHIR, controlled CSV/offline exchange and future national or programme-specific systems can use the same governance, provenance, reconciliation and fail-closed boundaries.
