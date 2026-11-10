#!/usr/bin/env node

const baseUrl = process.env.DHIS2_BASE_URL?.trim();
const token = process.env.DHIS2_BEARER_TOKEN?.trim();
const allowedHosts = (process.env.DHIS2_ALLOWED_HOSTS ?? '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
const timeoutMs = Math.min(Math.max(Number.parseInt(process.env.DHIS2_TIMEOUT_MS ?? '10000', 10) || 10000, 1000), 30000);

function fail(message) { console.error(`DHIS2 staging smoke test: ${message}`); process.exitCode = 1; }

if (!baseUrl) fail('DHIS2_BASE_URL is required');
if (!token) fail('DHIS2_BEARER_TOKEN is required');
if (!baseUrl || !token) process.exit();

let url;
try { url = new URL('/api/metadata', baseUrl); } catch { fail('DHIS2_BASE_URL must be a valid URL'); process.exit(); }
if (url.protocol !== 'https:') { fail('DHIS2_BASE_URL must use HTTPS'); process.exit(); }
if (allowedHosts.length === 0) { fail('DHIS2_ALLOWED_HOSTS must explicitly allow the DHIS2 hostname'); process.exit(); }
if (!allowedHosts.includes(url.hostname.toLowerCase())) { fail('DHIS2 host is not in DHIS2_ALLOWED_HOSTS'); process.exit(); }

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), timeoutMs);
try {
  const response = await fetch(url, {
    method: 'GET',
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    redirect: 'error',
    signal: controller.signal,
  });
  if (!response.ok) { fail(`metadata request returned HTTP ${response.status}`); process.exit(); }
  const body = await response.json();
  if (!body || typeof body !== 'object') { fail('metadata response was not a JSON object'); process.exit(); }
  const indicatorCount = Array.isArray(body.indicators) ? body.indicators.length : 0;
  const orgUnitCount = Array.isArray(body.organisationUnits) ? body.organisationUnits.length : 0;
  console.log(JSON.stringify({ ok: true, provider: 'dhis2', metadataEndpoint: '/api/metadata', indicatorCount, organisationUnitCount }, null, 2));
} catch (error) {
  fail(error instanceof Error ? error.name === 'AbortError' ? 'metadata request timed out' : error.message : 'metadata request failed');
} finally {
  clearTimeout(timer);
}
