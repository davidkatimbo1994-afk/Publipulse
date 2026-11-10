# Deployment security checklist

This document is a deployment guide, not evidence that deployment controls have already passed. Use synthetic data until all applicable gates are verified.

## Identity configuration

Configure `OIDC_ISSUER`, `OIDC_AUDIENCE`, and `OIDC_JWKS_URL` from the chosen identity provider's official configuration. Issuer matching is exact. The API accepts signed JWTs with RS256 or ES256 only and validates signature, issuer, audience, and token time claims through `jose`. The current data model requires the token `sub` claim to be a UUID compatible with the organisation membership table. Confirm this matches the chosen provider before integration.

Every request to the signal API must include a `Bearer` access token and an `x-organization-id` UUID. That header selects a tenant but does not grant access: the API queries the database for an active membership and obtains the role from that database record. Never accept roles or organisation membership from arbitrary client JSON or unverified token metadata.

## Database runtime role

Apply migrations with a separate migration administrator. The application runtime role must not own the tables, must not be a superuser, and must not have `BYPASSRLS`. Store its credentials only in the deployment secret manager. A starting grant set for the current signal endpoints is shown below; review against the actual migration and provider before use.

```sql
-- Run as a database administrator after creating the role securely.
GRANT CONNECT ON DATABASE publipulse TO publipulse_app;
GRANT USAGE ON SCHEMA public TO publipulse_app;
GRANT SELECT ON TABLE organization_memberships TO publipulse_app;
-- Organisation onboarding (migration 040, docs/ORGANISATION_ONBOARDING.md). Without these the member and invitation
-- endpoints fail with permission errors. Note: no INSERT on organizations; only the provisioning connection creates those.
GRANT INSERT ON TABLE organization_memberships TO publipulse_app;
GRANT UPDATE (role, active, updated_at) ON TABLE organization_memberships TO publipulse_app;
GRANT SELECT, INSERT ON TABLE organization_invitations TO publipulse_app;
-- Community USSD/SMS intake (migration 041, docs/COMMUNITY_INTAKE.md). Append-only: no UPDATE or DELETE for the runtime role.
GRANT SELECT, INSERT ON TABLE community_intake_submissions TO publipulse_app;
GRANT SELECT, INSERT ON TABLE community_intake_reviews TO publipulse_app;
GRANT SELECT, INSERT ON TABLE community_sender_events TO publipulse_app;
GRANT USAGE, SELECT ON SEQUENCE community_sender_events_id_seq TO publipulse_app;
GRANT UPDATE (redeemed_at, redeemed_by, revoked_at, revoked_by) ON TABLE organization_invitations TO publipulse_app;
GRANT SELECT, INSERT ON TABLE signals TO publipulse_app;
GRANT UPDATE (status, version, updated_at) ON TABLE signals TO publipulse_app;
GRANT INSERT ON TABLE audit_events TO publipulse_app;
GRANT USAGE, SELECT ON SEQUENCE audit_events_id_seq TO publipulse_app;
```

The runtime connection must set `app.organization_id` transaction-locally only after token verification, and membership must be checked inside that tenant scope. Validate this with a real PostgreSQL integration test using the non-owner runtime role. The grants above cover signal intake/list plus status transitions. The update grant is restricted to the lifecycle columns; do not grant broad table access pre-emptively.

## Transport and deployment

- Production `WEB_ORIGIN` must be one exact HTTPS origin, without a path or trailing slash.
- `WEB_ORIGIN` may list up to five exact origins separated by commas (for example `https://app.example.org,https://field.example.org`). Wildcards, paths and plain-HTTP production origins are rejected at startup. The API answers any request whose `Origin` header is not in the list with 403 `origin_not_allowed`, and echoes only the matching origin in `Access-Control-Allow-Origin`. CORS allows the headers `content-type`, `authorization`, `idempotency-key`, `x-organization-id` and `x-client-mutation-id`.
- `DATABASE_URL` must be secret-managed. Production TLS certificate verification is enabled in the pool adapter. Confirm the selected provider's CA chain works without disabling verification.
- Do not expose database ports publicly. Use network restrictions and managed secret rotation.
- Terminate HTTPS at a trusted ingress. The app currently does not trust forwarded proxy headers. If deployed behind a proxy, configure trusted proxy ranges deliberately rather than enabling blanket proxy trust.
- Configure backups, retention, restore drills, resource limits and monitoring before onboarding real organisations.

## Required verification before production

1. Generate and commit `package-lock.json` from a supported networked environment.
2. Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and `npm audit --omit=dev` in CI.
3. Apply migrations to disposable PostgreSQL and run RLS, cross-tenant, audit immutability, idempotency and transaction rollback integration tests as the runtime role.
4. Test real identity-provider tokens, key rotation, expiry, wrong issuer, wrong audience, invalid signature, inactive membership and cross-tenant selection.
5. Verify readiness, graceful shutdown, TLS, backups and restoration in staging.
6. Complete privacy impact assessment, retention rules, incident response plan and public-health governance review.
