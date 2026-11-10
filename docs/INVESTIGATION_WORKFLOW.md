# Investigation workflow

Investigations are tenant-scoped review records linked to a signal. They are not diagnoses, official outbreak declarations, or a substitute for national surveillance protocols.

## API

- `POST /v1/signals/:signalId/investigations` creates an investigation. Body: `ownerUserId` (UUID of an active member of the same organisation) and optional `initialNote`.
- `GET /v1/signals/:signalId/investigations?limit=25` lists investigations for an accessible signal; `limit` is 1–100.
- `PATCH /v1/investigations/:investigationId` updates status, findings, or uncertainty. Every update requires `expectedVersion`.

## Permissions and integrity

Owners, administrators and reviewers may create and update investigations. Investigators may create investigations and update only investigations assigned to their own verified user ID. Other allowed organisation roles can read but cannot edit. Owner assignment is validated against active membership in the same organisation. Tenant scope is set inside each database transaction and reinforced by PostgreSQL row-level security.

Optimistic concurrency returns a conflict instead of overwriting a concurrent edit. Completed and cancelled investigations are terminal in this starter; reopening or editing a closed record requires a future reviewed policy rather than silently changing history. Audit events record the action, status, version and whether notes changed, but not the contents of findings or uncertainty notes.

Apply migrations in order: `001_initial_action_graph.sql`, then `002_investigation_version.sql`. Runtime roles must be non-owner, must not have `BYPASSRLS`, and must receive only reviewed table privileges.

Use synthetic data only until privacy, security and public-health governance approval is complete.
