# Evidence provenance contract

PubliPulse v0.7 records evidence metadata against a signal. It does not upload raw files, fetch source URLs, authenticate the publisher of a linked page, or assess scientific quality.

## Fields

- `evidenceType`: controlled source/evidence category.
- `description`: concise description of what the item supports or challenges; do not include direct identifiers or patient-level narratives.
- `sourceLabel`: human-readable origin label.
- `sourceUri`: optional HTTPS URL without embedded username/password. URLs are stored as text and never fetched by this API.
- `observedAt`: optional offset-aware timestamp describing when the evidence was observed.

## Access and audit

Evidence is created by owners, administrators, reviewers, investigators, and analysts. Evidence can be read by those roles plus responders and read-only members. The API resolves the active actor and organization membership before access; database operations set organization scope transaction-locally and rely on tenant RLS. Successful creation and its audit event share a transaction. The audit event stores metadata about evidence type and whether a source URI was supplied, not the description or source URL.

## Limitations

An HTTPS URL does not establish source authenticity, source availability, scientific validity, or absence of misleading content. This endpoint does not crawl URLs, preview external content, or accept file uploads. Evidence review status is initially `unreviewed`; status adjudication and formal decision linkage are separate workflow work. Use synthetic data until security, privacy, and public-health governance gates are passed.
