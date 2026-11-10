# Secure development standard

## Pull-request gates

- Typecheck, unit tests, integration tests and production build pass.
- No secrets or real health data in fixtures, logs, screenshots or commits.
- New routes declare authentication, permission, tenant scope, validation, rate limit and audit behaviour.
- Database migrations are reviewed for tenant isolation, constraints, indexes, locking and rollback/forward-recovery strategy.
- New dependencies have a documented purpose; lockfile changes are reviewed and vulnerability checks run.
- High-risk changes include abuse cases and tests for denied access, not only happy paths.

## Secrets and deployment

- Keep production secrets in the deployment secret manager, never `.env` committed to Git.
- Use separate credentials and data stores for local, test, staging and production.
- Use a non-owner database runtime role; migrations use a separate privileged role.
- Restrict CI token permissions to read-only unless a job demonstrably needs more.
- Pin GitHub Actions to reviewed commit SHAs before production release.
- Protect the main branch with required reviews and passing checks; use signed releases where practical.
- Enable secret scanning, dependency alerts, and a documented vulnerability-reporting route.

## Incident and recovery readiness

- Define incident severity, owner, notification process and evidence preservation.
- Test backup restoration, credential rotation, session revocation and rollback procedures.
- Record recovery objectives and test them with the pilot organisation.
- Keep a data inventory, purpose/retention schedule, access review cadence and deletion workflow.

## Release statement

A green CI run only means the checks in that workflow passed. It does not mean a security audit, privacy impact assessment, penetration test, clinical validation, or operational readiness assessment has occurred.
