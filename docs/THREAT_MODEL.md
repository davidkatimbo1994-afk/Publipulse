# Threat Model — initial baseline

## Assets
- Organisational records and evidence provenance
- User identities, memberships, roles and sessions
- Investigation notes and response decisions
- Audit events, exports, backups and integration credentials

## Trust boundaries
1. Public internet → API gateway
2. Authenticated user → organisation/tenant scope
3. Field device offline store → synchronisation endpoint
4. API → database/object storage/background jobs
5. Application → external AI, messaging or health-system integrations

## Threats to address before real data
- Broken object-level authorization and cross-tenant data leakage
- Credential theft, session fixation and weak account recovery
- Injection, malicious uploads, SSRF and unsafe outbound URL fetching
- Replay and duplicate offline submissions
- Lost/stolen devices and locally cached sensitive data
- Audit-log tampering or sensitive-data leakage through logs
- Abuse, scraping, denial of service and resource exhaustion
- Supply-chain compromise and leaked deployment secrets
- AI prompt injection, fabricated citations and accidental disclosure
- Inappropriate alerting or overconfident conclusions from low-quality data

## Required controls
- Deny-by-default authorization at every object operation; tenant isolation enforced in service and database layers
- MFA for privileged roles; secure, rotated sessions and safe recovery
- Strict schema validation, size limits, rate limits, safe output encoding and security headers
- Idempotency keys and transactional persistence for retried operations
- Encryption in transit/at rest; minimise offline data and provide remote session revocation
- Append-only audit design with restricted administration and integrity monitoring
- Egress allowlists for integrations; do not fetch arbitrary user-provided URLs
- Dependency scanning, lockfile, secret scanning, signed/reviewed releases and least-privilege CI
- No real health data in AI prompts by default; approved-source retrieval and human review
- Human-led triage, uncertainty display, escalation policy and monitored false-positive/negative rates

This is an initial threat model, not a completed security assessment. Review with the pilot organisation and qualified security/privacy personnel before production.
