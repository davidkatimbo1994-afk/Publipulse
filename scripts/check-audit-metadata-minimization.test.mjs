import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const sourceFiles = [
  'apps/api/src/postgres-signal-store.ts',
  'apps/api/src/postgres-evidence-store.ts',
  'apps/api/src/postgres-investigation-store.ts',
  'apps/api/src/postgres-decision-action-store.ts',
];
const sources = await Promise.all(sourceFiles.map(async (path) => [path, await readFile(new URL(path, root), 'utf8')]));

const forbiddenAuditMetadataKeys = new Set([
  'summary', 'description', 'sourceUri', 'source_uri', 'findings', 'uncertaintyNote',
  'uncertainty_note', 'rationale', 'evidenceSummary', 'evidence_summary',
  'completionEvidence', 'completion_evidence', 'initialNote', 'initial_note',
  'rawPayload', 'raw_payload', 'token', 'accessToken', 'refreshToken', 'password',
]);

test('audit metadata does not serialize raw health narratives, evidence, or credentials', () => {
  let checked = 0;
  for (const [path, source] of sources) {
    for (const match of source.matchAll(/JSON\.stringify\(\{([\s\S]*?)\}\)/g)) {
      const body = match[1];
      const keys = [...body.matchAll(/(?:^|[,\s])([A-Za-z_$][\w$]*)\s*:/g)].map((item) => item[1]);
      for (const key of keys) {
        assert.equal(forbiddenAuditMetadataKeys.has(key), false, `${path} writes sensitive field ${key} to audit metadata`);
      }
      checked += 1;
    }
  }
  assert.ok(checked >= 8, `expected to inspect audit metadata objects, inspected ${checked}`);
});

test('signal audit records keep only categorical metadata and replay markers', () => {
  const signal = sources.find(([path]) => path.endsWith('postgres-signal-store.ts'))[1];
  assert.match(signal, /JSON\.stringify\(\{ sourceType: input\.sourceType, category: input\.category \}\)/);
  assert.match(signal, /'signal\.idempotency_conflict'.*\{"idempotent":false\}/s);
  assert.match(signal, /'signal\.replayed'.*\{"idempotent":true\}/s);
});

test('evidence and investigation audit records use presence flags instead of copying source text', () => {
  const evidence = sources.find(([path]) => path.endsWith('postgres-evidence-store.ts'))[1];
  const investigation = sources.find(([path]) => path.endsWith('postgres-investigation-store.ts'))[1];
  assert.match(evidence, /hasSourceUri: Boolean\(input\.sourceUri\)/);
  assert.match(investigation, /hasInitialNote: Boolean\(input\.initialNote\)/);
  assert.match(investigation, /findingsChanged: input\.findings !== undefined/);
  assert.match(investigation, /uncertaintyChanged: input\.uncertaintyNote !== undefined/);
});

test('workflow audit inserts occur before the transaction commit', () => {
  for (const [path, source] of sources) {
    const auditPositions = [...source.matchAll(/INSERT INTO audit_events/g)].map((match) => match.index);
    for (const position of auditPositions) {
      const commit = source.indexOf("query('COMMIT')", position);
      const rollback = source.indexOf("query('ROLLBACK')", position);
      assert.ok(commit !== -1 || rollback !== -1, `${path}: audit write has no visible transaction completion`);
      if (commit !== -1 && (rollback === -1 || commit < rollback)) {
        assert.ok(commit > position, `${path}: commit must follow audit write`);
      }
    }
  }
});


test('versioned workflow audit records preserve both prior and resulting versions', () => {
  const action = sources.find(([path]) => path.endsWith('postgres-decision-action-store.ts'))[1];
  const investigation = sources.find(([path]) => path.endsWith('postgres-investigation-store.ts'))[1];
  assert.match(action, /previousVersion:old\.version,version:row\.version/);
  assert.match(investigation, /previousVersion: old\.version, version: row\.version/);
  assert.match(action, /old\.version!==input\.expectedVersion/);
  assert.match(investigation, /old\.version !== input\.expectedVersion/);
});

test('version-aware workflow audit records are written in the same transaction as the update', () => {
  const action = sources.find(([path]) => path.endsWith('postgres-decision-action-store.ts'))[1];
  const investigation = sources.find(([path]) => path.endsWith('postgres-investigation-store.ts'))[1];
  const actionUpdate = action.slice(action.indexOf("'response_action.updated'"));
  const investigationUpdate = investigation.slice(investigation.indexOf("'investigation.updated'"));
  for (const [path, section] of [['response action', actionUpdate], ['investigation', investigationUpdate]]) {
    const auditWrite = section.slice(0, section.indexOf("query('COMMIT')"));
    assert.match(auditWrite, /previousVersion/ , `${path}: versioned audit entry should include the previous version`);
    assert.match(auditWrite, /version\s*:\s*row\.version/ , `${path}: versioned audit entry should include the resulting version`);
    assert.ok(section.indexOf("query('COMMIT')") > 0, `${path}: audit write should precede commit`);
  }
});
