import { describe, expect, it } from 'vitest';
import { PostgresOutcomeStore, indicatorCode, ASSESSMENT_METHOD_MAX } from '../src/postgres-outcome-store.js';
import type { SqlConnection, SqlPool, SqlResult } from '../src/postgres-signal-store.js';
import type { OutcomeAssessment } from '@publipulse/shared';

/**
 * Constraint-aware fake. It parses the real INSERT text and enforces the same rules the
 * migrations (001, 011, 031) enforce, so an arity or length mismatch fails here, not in the field.
 */
const ORG = '1dfe2db1-8b0e-4cbd-bf12-c4fdbf01d3d1';
const actor = { userId: '2dfe2db1-8b0e-4cbd-bf12-c4fdbf01d3d1', organizationId: ORG, roles: ['responder'] as const };
const SIGNAL = '3dfe2db1-8b0e-4cbd-bf12-c4fdbf01d3d1';
const ACTION = '4dfe2db1-8b0e-4cbd-bf12-c4fdbf01d3d1';
const OTHER_SIGNAL = '7dfe2db1-8b0e-4cbd-bf12-c4fdbf01d3d1';
const MUT = '5dfe2db1-8b0e-4cbd-bf12-c4fdbf01d3d1';

class DbError extends Error { constructor(m: string, readonly code: string) { super(m); } }
const len = (v: unknown) => String(v ?? '').trim().length;

function enforce(row: Record<string, unknown>) {
  const need = (k: string) => { if (row[k] === null || row[k] === undefined) throw new DbError(`null value in ${k}`, '23502'); };
  ['organization_id', 'signal_id', 'indicator_code', 'indicator_label', 'measured_at', 'method_note', 'recorded_by'].forEach(need);
  const between = (k: string, lo: number, hi: number, nullable = false) => {
    if (row[k] === null || row[k] === undefined) { if (nullable) return; }
    const n = len(row[k]); if (n < lo || n > hi) throw new DbError(`check violated: ${k} length ${n} not in ${lo}..${hi}`, '23514');
  };
  between('indicator_code', 1, 120); between('indicator_label', 1, 240); between('method_note', 3, 3000);
  between('evidence_source', 1, 240, true); between('assessment_method', 3, 1000, true);
  if (row.uncertainty_note != null && String(row.uncertainty_note).length > 3000) throw new DbError('uncertainty too long', '23514');
  if (row.limitation_note != null && String(row.limitation_note).length > 3000) throw new DbError('limitation too long', '23514');
  if (row.assessment_result != null && !['improved', 'no_change', 'worsened', 'inconclusive'].includes(String(row.assessment_result))) throw new DbError('bad result', '23514');
}

class FakeConn implements SqlConnection {
  inserts: Array<Record<string, unknown>> = [];
  constructor(private readonly db: FakeDb) {}
  async query<Row = Record<string, unknown>>(text: string, values: readonly unknown[] = []): Promise<SqlResult<Row>> {
    if (/INSERT INTO outcomes/.test(text)) {
      const cols = /INSERT INTO outcomes \(([^)]*)\)/.exec(text)![1]!.split(',').map((c) => c.trim());
      const exprs = /VALUES\(([^)]*)\)/.exec(text)![1]!.split(',').map((c) => c.trim());
      if (cols.length !== exprs.length) throw new DbError('INSERT has more target columns than expressions', '42601');
      const row: Record<string, unknown> = {};
      cols.forEach((c, i) => { row[c] = values[Number(exprs[i]!.slice(1)) - 1] ?? null; });
      enforce(row);
      if (this.db.raceOnce) { this.db.raceOnce = false; this.db.stored.push(this.db.makeRow({ ...row, ...(this.db.raceOverride ?? {}) })); throw new DbError('duplicate key', '23505'); }
      const full = this.db.makeRow(row); this.db.stored.push(full); this.db.insertedCount++;
      return { rows: [full as Row], rowCount: 1 };
    }
    if (/FROM outcomes WHERE organization_id=\$1 AND client_mutation_id=\$2/.test(text)) {
      const hit = this.db.stored.find((r) => r.client_mutation_id === values[1]);
      return { rows: hit ? [hit as Row] : [], rowCount: hit ? 1 : 0 };
    }
    if (/FROM signals/.test(text)) return { rows: [{ id: SIGNAL } as Row], rowCount: 1 };
    if (/FROM response_actions/.test(text)) return { rows: [{ id: ACTION } as Row], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  }
  release() { this.db.open--; }
}
class FakeDb implements SqlPool {
  stored: Array<Record<string, unknown>> = []; insertedCount = 0; raceOnce = false; open = 0; maxOpen = 0; raceOverride: Record<string, unknown> | null = null;
  makeRow(r: Record<string, unknown>) { return { id: '6dfe2db1-8b0e-4cbd-bf12-c4fdbf01d3d1', created_at: new Date('2026-10-16T10:00:00Z'), ...r }; }
  async connect() { this.open++; this.maxOpen = Math.max(this.maxOpen, this.open); return new FakeConn(this); }
}

const base: OutcomeAssessment = {
  actionId: ACTION, indicatorName: 'Water samples meeting safety standard', result: 'improved',
  baselineValue: 40, targetValue: 90, followUpValue: 85, unit: '%',
  evidenceSummary: 'Lab results from the district water office show improvement.',
  evidenceReference: 'District lab report 2026-10', assessedAt: '2026-10-16T09:00:00Z'
};

describe('PostgresOutcomeStore', () => {
  it('records an outcome (column/placeholder arity matches the real INSERT)', async () => {
    const db = new FakeDb();
    const r = await new PostgresOutcomeStore(db).create(actor, SIGNAL, base);
    expect(r.kind).toBe('created');
    if (r.kind === 'created') {
      expect(r.outcome.result).toBe('improved');
      expect(r.outcome.followUpValue).toBe(85);
      expect(r.outcome.evidenceReference).toBe('District lab report 2026-10');
    }
    expect(db.insertedCount).toBe(1);
  });

  it('accepts maximum-length valid input without violating any DB check', async () => {
    const db = new FakeDb();
    const r = await new PostgresOutcomeStore(db).create(actor, SIGNAL, {
      ...base, indicatorName: 'x'.repeat(240), evidenceSummary: 'e'.repeat(3000),
      evidenceReference: 'r'.repeat(240), uncertaintyNote: 'u'.repeat(3000)
    });
    expect(r.kind).toBe('created');
    expect(String(db.stored[0]!.assessment_method).length).toBeLessThanOrEqual(ASSESSMENT_METHOD_MAX);
    expect(String(db.stored[0]!.method_note).length).toBe(3000); // full evidence is preserved
  });

  it('never produces an indicator_code longer than 120 characters or empty', () => {
    expect(indicatorCode('a'.repeat(500)).length).toBeLessThanOrEqual(120);
    expect(indicatorCode('!!').length).toBeGreaterThan('assessment:'.length);
    expect(indicatorCode('Water  Quality / Index')).toBe('assessment:water-quality-index');
  });

  it('replaying a client mutation id returns the stored outcome without inserting twice', async () => {
    const db = new FakeDb(); const store = new PostgresOutcomeStore(db);
    await store.create(actor, SIGNAL, base, MUT);
    const again = await store.create(actor, SIGNAL, base, MUT);
    expect(again.kind).toBe('created');
    expect(db.insertedCount).toBe(1);
  });

  it('a concurrent duplicate (unique violation) resolves to the stored outcome, not an error', async () => {
    const db = new FakeDb(); db.raceOnce = true;
    const r = await new PostgresOutcomeStore(db).create(actor, SIGNAL, base, MUT);
    expect(r.kind).toBe('created');
    expect(db.stored).toHaveLength(1);
  });

  it('rejects a replayed client mutation id that targets a different signal', async () => {
    const db = new FakeDb(); const store = new PostgresOutcomeStore(db);
    await store.create(actor, SIGNAL, base, MUT);
    const again = await store.create(actor, OTHER_SIGNAL, base, MUT);
    expect(again.kind).toBe('mutation_conflict');
    expect(db.insertedCount).toBe(1);
  });

  it('rejects a replayed client mutation id that targets a different action', async () => {
    const db = new FakeDb(); const store = new PostgresOutcomeStore(db);
    await store.create(actor, SIGNAL, base, MUT);
    const again = await store.create(actor, SIGNAL, { ...base, actionId: '8dfe2db1-8b0e-4cbd-bf12-c4fdbf01d3d1' }, MUT);
    expect(again.kind).toBe('mutation_conflict');
  });

  it('a concurrent duplicate for a different signal is a conflict, not a silent success', async () => {
    const db = new FakeDb(); db.raceOnce = true; db.raceOverride = { signal_id: OTHER_SIGNAL };
    const r = await new PostgresOutcomeStore(db).create(actor, SIGNAL, base, MUT);
    expect(r.kind).toBe('mutation_conflict');
  });

  it('duplicate-key recovery never holds two pool connections at once', async () => {
    const db = new FakeDb(); db.raceOnce = true;
    await new PostgresOutcomeStore(db).create(actor, SIGNAL, base, MUT);
    expect(db.maxOpen).toBe(1);
    expect(db.open).toBe(0);
  });
});
