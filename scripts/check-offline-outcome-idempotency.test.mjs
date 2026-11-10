import { readWebSource } from './lib/web-source.mjs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=fileURLToPath(new URL('..', import.meta.url));
test('offline outcome migration adds organization-scoped client mutation idempotency',()=>{
 const sql=fs.readFileSync(new URL('../apps/api/migrations/031_offline_outcome_idempotency.sql',import.meta.url),'utf8');
 assert.match(sql,/client_mutation_id uuid/i); assert.match(sql,/UNIQUE INDEX/i); assert.match(sql,/organization_id, client_mutation_id/i);
});
test('outcome route accepts client mutation ids',()=>{
 const src=fs.readFileSync(new URL('../apps/api/src/outcome-routes.ts',import.meta.url),'utf8');
 assert.match(src,/x-client-mutation-id/); assert.match(src,/invalid_client_mutation_id/); assert.match(src,/opts\.store\.create\(actor,signalId,parsed\.data,clientMutationId\)/);
});
test('offline outcome replay sends the client mutation id',()=>{
 const src=readWebSource();
 assert.match(src,/x-client-mutation-id/); assert.match(src,/item\.clientMutationId/);
});
