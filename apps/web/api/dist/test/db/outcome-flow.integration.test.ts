import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresOutcomeStore } from '../../src/postgres-outcome-store.js';

/**
 * Real-PostgreSQL end-to-end check of the product's core path:
 *   organization -> signal -> response action -> outcome assessment -> readback.
 * Skipped unless TEST_DATABASE_URL is set. Use a THROWAWAY database: this applies every migration to it.
 *   TEST_DATABASE_URL=postgres://user:pass@localhost:5432/publipulse_test npm run test:db
 */
const url = process.env.TEST_DATABASE_URL;
const migrationsDir = fileURLToPath(new URL('../../migrations', import.meta.url));

describe.skipIf(!url)('outcome flow against real PostgreSQL', () => {
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  const orgId = randomUUID(), userId = randomUUID(), signalId = randomUUID(), actionId = randomUUID();

  beforeAll(async () => {
    // Apply migrations only to an empty database, so the test can be re-run on the same throwaway DB.
    const migrated = await pool.query("SELECT to_regclass('public.outcomes') IS NOT NULL AS done");
    if (!migrated.rows[0].done) {
      const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
      for (const f of files) {
        try { await pool.query(readFileSync(join(migrationsDir, f), 'utf8')); }
        catch (e) { throw new Error(`migration ${f} failed: ${(e as Error).message}`); }
      }
    }
    // Tables use FORCE ROW LEVEL SECURITY, which only superusers bypass. Seed inside a tenant-scoped
    // transaction exactly as the stores do, so this works for an ordinary owner role too.
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query("SELECT set_config('app.organization_id', $1, true)", [orgId]);
      await c.query("INSERT INTO organizations (id, name, country_code) VALUES ($1, 'Integration Test District', 'UG')", [orgId]);
      await c.query(
        `INSERT INTO signals (id, organization_id, submitted_by, client_submission_id, category, summary, source_type, observed_at, administrative_area_code, location_precision)
         VALUES ($1,$2,$3,$4,'environmental_hazard','Standing water near a community water point.','field_observation', now(), 'UG-C','community')`,
        [signalId, orgId, userId, randomUUID()]);
      await c.query(
        `INSERT INTO response_actions (id, organization_id, signal_id, title, owner_user_id, created_by)
         VALUES ($1,$2,$3,'Chlorinate water point',$4,$4)`, [actionId, orgId, signalId, userId]);
      await c.query('COMMIT');
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }, 120_000);

  afterAll(async () => { await pool.end(); });

  const actor = () => ({ userId, organizationId: orgId, roles: ['responder'] as const });
  const input = {
    actionId, indicatorName: 'Water samples meeting safety standard', result: 'improved' as const,
    baselineValue: 40, targetValue: 90, followUpValue: 85, unit: '%',
    evidenceSummary: 'Lab results from the district water office show improvement.',
    evidenceReference: 'District lab report 2026-10', assessedAt: '2026-10-16T09:00:00Z'
  };

  it('records an outcome and reads it back', async () => {
    const store = new PostgresOutcomeStore(pool as never);
    const created = await store.create(actor(), signalId, input);
    expect(created.kind).toBe('created');
    const rows = await store.list(actor(), signalId, 10);
    expect(rows).not.toBeNull();
    expect(rows!.some((r) => r.result === 'improved' && r.followUpValue === 85)).toBe(true);
  });

  it('replaying the same client mutation id stores exactly one outcome', async () => {
    const store = new PostgresOutcomeStore(pool as never); const mut = randomUUID();
    await store.create(actor(), signalId, { ...input, indicatorName: 'Replay check' }, mut);
    await store.create(actor(), signalId, { ...input, indicatorName: 'Replay check' }, mut);
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query("SELECT set_config('app.organization_id', $1, true)", [orgId]);
      const { rows } = await c.query('SELECT count(*)::int AS n FROM outcomes WHERE organization_id=$1 AND client_mutation_id=$2', [orgId, mut]);
      await c.query('COMMIT');
      expect(rows[0].n).toBe(1);
    } finally { c.release(); }
  });

  it('accepts maximum-length valid input (no DB check violations)', async () => {
    const store = new PostgresOutcomeStore(pool as never);
    const r = await store.create(actor(), signalId, { ...input, indicatorName: 'x'.repeat(240), evidenceSummary: 'e'.repeat(3000), evidenceReference: 'r'.repeat(240), uncertaintyNote: 'u'.repeat(3000) });
    expect(r.kind).toBe('created');
  });

  it("does not leak outcomes across organizations", async () => {
    const other = { userId, organizationId: randomUUID(), roles: ['responder'] as const };
    const rows = await new PostgresOutcomeStore(pool as never).list(other, signalId, 10);
    expect(rows === null || rows.length === 0).toBe(true);
  });
});
