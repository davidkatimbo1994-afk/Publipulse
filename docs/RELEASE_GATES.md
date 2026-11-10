# Release gates

No production release or real health data until every applicable gate has evidence attached to the release record.

## Build and supply chain
- [ ] `npm run check:release-readiness` reports no static blockers; warnings and external evidence are reviewed separately
- [ ] Supported Node/npm versions documented and enforced
- [ ] `package-lock.json` generated on a networked supported npm environment and committed
- [ ] `npm run check:migration-checksums` passes; existing migration files remain immutable and changes use a new numbered migration
- [ ] Clean `npm ci`, typecheck, unit tests, integration tests and production build pass in CI
- [ ] Dependency audit reviewed; exceptions have owner and expiry
- [ ] GitHub Actions pinned to reviewed immutable commit SHAs for production
- [ ] Secret scanning enabled; no secrets in repository or build artifacts

## Identity and access
- [ ] Production identity provider integrated and recovery paths reviewed
- [ ] MFA enforced for privileged roles
- [ ] Permission matrix approved; deny-by-default checks tested for every object operation
- [ ] Cross-tenant isolation integration tests pass against PostgreSQL with runtime role (CI test added in v0.5.0; execution result still required)
- [ ] Runtime database role is not table owner and has least privilege

## Data and privacy
- [ ] Data inventory, purpose, lawful basis, retention and deletion policies approved
- [ ] Privacy impact assessment completed with pilot organisation
- [ ] No unnecessary direct identifiers in initial intake
- [ ] Audit retention, restricted access, monitoring and export controls tested
- [ ] Backup restore and data export/deletion workflows tested

## Operational safety
- [ ] Rate limits, request/body limits and abuse controls tested
- [ ] Monitoring, alerting, incident response and on-call ownership established
- [ ] Readiness endpoint checks real required dependencies
- [ ] Offline sync, idempotency, concurrent edits and interrupted network tests pass
- [ ] Clinical/public-health governance approves intended use and escalation rules
- [ ] Pilot uses synthetic or formally approved data under an authorised protocol
- [ ] Security review and appropriate penetration testing completed

Passing these gates is a release decision, not an automatic consequence of a successful build.


## v0.6.0 lifecycle gates

- [ ] Verify role/status transition matrix with tests.
- [ ] Verify stale version returns a conflict and does not write an audit success event.
- [ ] Verify status update plus audit insert roll back together on failure.
- [ ] Run disposable PostgreSQL RLS and lifecycle integration job.
- [ ] Generate and commit package-lock.json; pass clean install, typecheck, tests, production build and dependency audit.


## v0.13.0 migration-chain gate

- [ ] `npm run check:migrations` passes and reports every sequential migration.
- [ ] CI applies all migration files discovered from `apps/api/migrations/*.sql` in lexical order to disposable PostgreSQL.
- [ ] Static migration checks are not treated as proof of PostgreSQL runtime correctness; the integration job must pass as well.


## Migration checksum maintenance

`apps/api/migrations/SHA256SUMS` records the SHA-256 digest of every SQL migration. CI checks it before applying migrations. Do not edit a migration that may already have been applied to an environment: create the next numbered migration instead. For an intentional, reviewed change to a migration that has never been released, regenerate the manifest from the repository root with `sha256sum apps/api/migrations/*.sql | sed 's#apps/api/migrations/##' > apps/api/migrations/SHA256SUMS`, inspect the diff, and run `npm run check:migration-checksums`. The checksum manifest detects file drift; it is not a signature and does not prove database state or migration correctness.
