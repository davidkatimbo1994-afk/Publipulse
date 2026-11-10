import test from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = fileURLToPath(new URL('..', import.meta.url));
const migration = fs.readFileSync(`${root}/apps/api/migrations/018_dhis2_metadata_mapping.sql`, 'utf8');
const moduleText = fs.readFileSync(`${root}/packages/shared/src/dhis2-metadata.ts`, 'utf8');
const reconciliation = fs.readFileSync(`${root}/apps/api/src/dhis2-metadata-reconciliation.ts`, 'utf8');

test('Phase 7F creates versioned DHIS2 metadata mapping evidence', () => {
  assert.match(migration, /dhis2_indicator_mappings/);
  assert.match(migration, /dhis2_org_unit_mappings/);
  assert.match(migration, /dhis2_metadata_reconciliation_runs/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(moduleText, /Dhis2MetadataSnapshotSchema/);
  assert.match(moduleText, /compareIndicatorMapping/);
  assert.match(moduleText, /compareOrgUnitMapping/);
  assert.match(reconciliation, /drift_detected/);
});
