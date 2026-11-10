# Docker (local development and evaluation)

This stack runs PostgreSQL, the migrations, the API, the web command center and the field PWA. It is for development and evaluation with synthetic data. It is not a production deployment; see `DEPLOYMENT_SECURITY.md`.

## Before the first build

1. Commit `package-lock.json` (`npm run lockfile:refresh` on a networked machine). The image build runs `npm ci` and refuses to continue without it, matching the repository's lockfile policy. For a throwaway local experiment only, set `ALLOW_NO_LOCKFILE=1`; never deploy that image.
2. `cp .env.docker.example .env` and set both database passwords.
3. To use the API you need an identity provider: set `OIDC_ISSUER`, `OIDC_AUDIENCE` and `OIDC_JWKS_URL`. If any is empty the API starts fail-closed and serves only `/health/live` and `/health/ready`.

## Run

```sh
docker compose up --build
```

| Service | URL | Notes |
| --- | --- | --- |
| web | http://localhost:5173 | Enter the API base `http://localhost:4000` in Settings. |
| field | http://localhost:5174 | Enter the API base and organization ID in the Sync tab. |
| api | http://localhost:4000 | `/health/live`, `/health/ready` |
| db | internal only | Not published to the host. |

`migrate` runs once per `up`, applies each new file in `apps/api/migrations` in order and records its SHA-256 in `schema_migrations`. It stops if an already-applied file has changed. Then it creates the runtime role `publipulse_app` (not an owner, no superuser, no `BYPASSRLS`).

## Images

```sh
docker build --target api   -t publipulse-api .
docker build --target web   -t publipulse-web .
docker build --target field -t publipulse-field .
```

The API image defaults to `NODE_ENV=production`, which requires HTTPS `WEB_ORIGIN` values and a TLS database connection. The compose file overrides it to `development` because the local stack is plain HTTP. The two nginx images listen on 8080 as an unprivileged user.

## Limits of this setup

- `docker/db/roles.sql` grants broad table access so every endpoint works locally. Replace it with the reviewed least-privilege grants before any real deployment.
- The nginx Content-Security-Policy is report-only until it has been checked in a real browser against your deployment.
- TLS, backups, secrets management and trusted-proxy configuration are not handled here.
