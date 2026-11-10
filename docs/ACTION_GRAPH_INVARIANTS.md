# Action Graph invariants

These are product-level invariants. Every API route, background job and import path must preserve them.

1. **Tenant integrity:** every referenced record belongs to the same organisation as its parent; tenant scope comes from verified server-side membership, never from an untrusted body field.
2. **Source preservation:** an observation's original source, submitter and observed time remain traceable. Corrections create an auditable change rather than silently rewriting history.
3. **No unsupported certainty:** a signal is not an outbreak declaration. Verification status, evidence quality and uncertainty are separate fields.
4. **Decision accountability:** a consequential decision requires an authenticated actor, a permitted role, a rationale and an audit event.
5. **Action accountability:** response actions have an owner and lifecycle state; completion requires a completion timestamp and evidence or an explicitly documented reason.
6. **Idempotent intake:** a repeated `(organization, submitter, client_submission_id)` returns the existing submission rather than creating another signal.
7. **Transactional integrity:** a state change, graph edge and audit event commit atomically where they describe the same operation.
8. **Append-only audit:** application runtime credentials cannot update or delete audit rows. Corrections are represented by additional events.
9. **No hidden graph or AI authority:** every edge has a defined relation; AI suggestions are attributed and reviewable, and cannot change official status without a human-authorised command.
10. **Minimise sensitive data:** initial signal intake does not accept patient names, phone numbers, national IDs, free-form direct identifiers or exact household coordinates.

## Required implementation patterns

- Use a database transaction for tenant context (`SET LOCAL app.organization_id = ...`) and all related reads/writes.
- Resolve organisation membership with a trusted authentication identity and a carefully reviewed access path. Never trust a user-supplied `organization_id` alone.
- Validate every edge endpoint against the same tenant and expected node type before inserting `graph_edges`.
- Use optimistic concurrency (`version`) for mutable aggregate records and return a conflict response for stale updates.
- Use an idempotency key or unique client submission identifier for retryable commands.
- Use an outbox table for future asynchronous notifications; do not publish an event before the database transaction commits.
- Enforce status transitions in a domain service and test allowed and disallowed transitions.

The initial SQL migration establishes part of the data boundary. It is not a substitute for an authentication integration, reviewed database grants, migration execution, or tenant-isolation integration tests against a real PostgreSQL instance.
