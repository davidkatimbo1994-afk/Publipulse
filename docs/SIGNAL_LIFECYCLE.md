# Signal lifecycle contract

The lifecycle is a review aid, not an automated public-health determination. A status must never be treated as a diagnosis or an outbreak declaration.

## Allowed transitions

| Current status | Allowed next status |
| --- | --- |
| `submitted` | `under_review`, `dismissed` |
| `under_review` | `investigating`, `verified`, `dismissed` |
| `investigating` | `under_review`, `verified`, `dismissed` |
| `verified` | `closed` |
| `dismissed` | `closed` |
| `closed` | none |

## Role boundaries

- `owner`, `administrator`, and `reviewer` may start review, move a signal into investigation, verify, dismiss, and close a signal.
- `investigator` may move a signal into investigation, but cannot independently verify, dismiss, or close it.
- Other roles may not change signal status.
- These rules are enforced by the API and must be reviewed alongside database permissions; the database also enforces tenant isolation.

## Concurrency and audit

`PATCH /v1/signals/:signalId/status` requires `expectedVersion`. A stale version returns `409 signal_version_conflict`; the client must reload and ask the user to retry rather than silently overwrite another reviewer's work. A successful change increments `version` and writes an audit event in the same database transaction. Audit metadata contains status transition metadata only; it intentionally excludes free-text health narratives.

The current endpoint does not replace a formal decision record or evidence review. Those linked records remain separate workflow milestones. Use synthetic data until the full integration and governance gates pass.
