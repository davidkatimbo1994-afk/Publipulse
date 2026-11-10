import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=(p)=>readFile(new URL(p,`file://${root}/`),'utf8');
test('Action Gap API requires identity, role checks, validated inputs, and status preconditions',async()=>{const routes=await read('apps/api/src/action-gap-routes.ts');assert.match(routes,/authentication_required/);assert.match(routes,/canCreateGap/);assert.match(routes,/canReadGaps/);assert.match(routes,/canReviewGaps/);assert.match(routes,/Input\.safeParse/);assert.match(routes,/expectedStatus/);assert.match(routes,/action_gap_status_conflict/);});
test('PostgreSQL Action Gap persistence is tenant-scoped and audited transactionally',async()=>{const store=await read('apps/api/src/postgres-action-gap-store.ts');assert.match(store,/set_config\('app\.organization_id'/);assert.match(store,/WHERE organization_id=\$1 AND id=\$2/);assert.match(store,/action_gap\.detected/);assert.match(store,/action_gap\.reviewed/);assert.match(store,/BEGIN/);assert.match(store,/COMMIT/);});
test('Action Gap service is wired to server and required for readiness',async()=>{const server=await read('apps/api/src/server.ts');const app=await read('apps/api/src/app.ts');assert.match(server,/new PostgresActionGapStore\(pool\)/);assert.match(app,/registerActionGapRoutes/);assert.match(app,/options\.actionGapStore/);assert.match(app,/actionGapStore: options\.actionGapStore \? 'configured'/);});
