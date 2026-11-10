# Phase 7 — Controlled DHIS2 Pilot Transport

## Purpose
This release adds a deployment-time metadata smoke test for one approved DHIS2 upstream system. It is intentionally not a background connector and it does not create a live integration automatically.

## Required deployment configuration
- `DHIS2_BASE_URL`: HTTPS base URL for the approved DHIS2 instance.
- `DHIS2_ALLOWED_HOSTS`: explicit comma-separated hostname allowlist.
- `DHIS2_BEARER_TOKEN`: deployment secret; never commit or log it.
- `DHIS2_TIMEOUT_MS`: optional 1,000–30,000 ms timeout.

## Safety controls
- HTTPS is mandatory.
- Hostname must be explicitly allowlisted.
- Redirects are rejected.
- Request timeout is bounded.
- Only the metadata endpoint is contacted by the smoke test.
- The bearer token is supplied at runtime and is never persisted by PubliPulse.
- A successful metadata request is not proof that event intake or aggregate export is authorized.

## Pilot sequence
1. Verify the organization integration profile is `verified`.
2. Run `npm run pilot:dhis2:metadata` in the controlled staging environment.
3. Validate returned metadata against the versioned PubliPulse mappings.
4. Run a non-production exchange test with approved aggregate data.
5. Capture provider receipt and reconciliation evidence.
6. Only then consider enabling a narrowly scoped production adapter.

## Current boundary
PubliPulse remains the outcome/accountability overlay. The upstream DHIS2 system remains the detection/source-of-record system. This release does not claim a live production DHIS2 integration.
