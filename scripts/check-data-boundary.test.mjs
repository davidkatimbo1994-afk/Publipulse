import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('public-health narrative schemas apply the direct-identifier boundary', async () => {
  const files = ['packages/shared/src/signal.ts','packages/shared/src/decision-action.ts','packages/shared/src/outcome-assessment.ts','packages/shared/src/outcome-intelligence.ts','packages/shared/src/outcome-root-cause.ts'];
  for (const file of files) {
    const source = await readFile(new URL(file, root), 'utf8');
    assert.match(source, /publicHealthNarrative/);
  }
});

test('database boundary checks avoid non-PostgreSQL lookbehind syntax', async () => {
  const source = await readFile(new URL('apps/api/migrations/027_data_boundary_checks.sql', root), 'utf8');
  assert.doesNotMatch(source, /\(\?<[/!]/);
  assert.match(source, /signals_summary_no_common_direct_identifier/);
  assert.match(source, /evidence_description_no_common_direct_identifier/);
});
