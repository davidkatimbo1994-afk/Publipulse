import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const route = await readFile(new URL('../apps/api/src/learning-routes.ts', import.meta.url), 'utf8');
const store = await readFile(new URL('../apps/api/src/postgres-learning-store.ts', import.meta.url), 'utf8');
const migration = await readFile(new URL('../apps/api/migrations/034_pilot_evidence_records.sql', import.meta.url), 'utf8');
const schema = await readFile(new URL('../packages/shared/src/pilot-evidence.ts', import.meta.url), 'utf8');
const doc = await readFile(new URL('../docs/PILOT_EVIDENCE_RECORD.md', import.meta.url), 'utf8');

test('pilot evidence API validates bounded structured implementation evidence', () => {
  assert.match(route, /\/v1\/learning\/pilot-evidence/);
  assert.match(route, /PilotEvidenceRecordInputSchema\.safeParse/);
  assert.match(schema, /weeklyDecisionChangeCount/);
  assert.match(schema, /offlineSyncIncidentCount/);
  assert.match(schema, /integrationIncidentCount/);
  assert.match(schema, /privacyIncidentCount/);
  assert.match(schema, /securityIncidentCount/);
});

test('pilot evidence is calculated server-side and persisted as a snapshot', () => {
  assert.match(store, /async recordPilotEvidence\(/);
  assert.match(store, /this\.outcomeDecay\(actor, baselineStart, baselineEnd/);
  assert.match(store, /this\.outcomeDecay\(actor, pilotStart, pilotEnd/);
  assert.match(store, /INSERT INTO pilot_evidence_records/);
});

test('pilot evidence storage is tenant isolated and append-only', () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /FORCE ROW LEVEL SECURITY/);
  assert.match(migration, /USING \(organization_id = nullif\(current_setting\('app\.organization_id'/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON pilot_evidence_records/);
  assert.match(migration, /REVOKE UPDATE, DELETE ON pilot_evidence_records FROM PUBLIC/);
});

test('pilot evidence documentation preserves non-causal interpretation', () => {
  assert.match(doc, /immutable/i);
  assert.match(doc, /does not establish causation/i);
  assert.match(doc, /privacy incidents/i);
});
