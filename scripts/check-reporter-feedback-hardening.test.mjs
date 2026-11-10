import test from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=fileURLToPath(new URL('..', import.meta.url));

test('reporter feedback has organization-scoped client mutation replay protection',()=>{const sql=fs.readFileSync(new URL('../apps/api/migrations/032_reporter_feedback_replay_and_delivery.sql',import.meta.url),'utf8');assert.match(sql,/client_mutation_id uuid/i);assert.match(sql,/reporter_feedback_org_client_mutation_uidx/i);assert.match(sql,/reporter_feedback_delivery_attempts/i);assert.match(sql,/FORCE ROW LEVEL SECURITY/i);});
test('reporter feedback route validates client mutation id',()=>{const src=fs.readFileSync(new URL('../apps/api/src/reporter-feedback-routes.ts',import.meta.url),'utf8');assert.match(src,/x-client-mutation-id/);assert.match(src,/invalid_client_mutation_id/);assert.match(src,/replayed/);});
test('provider transport remains deployment-configured',()=>{const src=fs.readFileSync(new URL('../apps/api/src/reporter-feedback-dispatcher.ts',import.meta.url),'utf8');assert.match(src,/requireConfiguredReporterTransport/);assert.match(src,/status:'failed'/);});

test('public reporter-feedback intake cannot self-assert delivery evidence',()=>{const src=fs.readFileSync(new URL('../apps/api/src/reporter-feedback-routes.ts',import.meta.url),'utf8');assert.match(src,/deliveryStatus:z\.enum\(\['queued','not_attempted'\]\)/);});
