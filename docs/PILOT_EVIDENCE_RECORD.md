# Pilot Evidence Record

## Purpose

A PubliPulse pilot should leave an immutable, organization-scoped evidence record rather than relying only on live dashboard values.

Each record captures the documented baseline and pilot windows, minimum privacy cell, server-calculated outcome comparison snapshot, and structured operational implementation counts.

## Recorded implementation evidence

- weekly decision changes
- offline synchronization incidents
- integration incidents
- privacy incidents
- security incidents

## Integrity rules

- Evidence records are append-only.
- PostgreSQL row-level security is enabled and forced.
- The comparison snapshot is calculated by PubliPulse from the selected windows at record time.
- No individual records are stored in the snapshot.
- A digest may be supplied to bind the record to an external pilot evidence bundle.

## Interpretation

The record documents implementation and descriptive outcome differences. It does not establish causation, clinical effectiveness, outbreak control, or superiority over an existing system.

The pilot team should retain the source definitions, cohort boundaries, integration status, field/offline incident log, privacy/security incident log, weekly review artifacts, and governance approvals alongside the immutable PubliPulse record.
