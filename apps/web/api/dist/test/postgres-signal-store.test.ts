import { describe, expect, it } from 'vitest';
import { PostgresSignalStore, type SqlConnection, type SqlPool, type SqlResult } from '../src/postgres-signal-store.js';
import type { SignalIntake } from '@publipulse/shared';

const input: SignalIntake = {
  clientSubmissionId: '8dfe2db1-8b0e-4cbd-bf12-c4fdbf01d3d1',
  category: 'environmental_hazard',
  summary: 'Standing water observed near a community water point.',
  observedAt: '2026-10-11T08:30:00Z',
  location: { administrativeAreaCode: 'UG-C', precision: 'community' },
  sourceType: 'field_observation'
};

class FakeConnection implements SqlConnection {
  calls: Array<{ text: string; values?: readonly unknown[] }> = [];
  released = false;
  constructor(private readonly failOnAudit = false) {}
  async query<Row = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<SqlResult<Row>> {
    this.calls.push({ text, ...(values ? { values } : {}) });
    if (this.failOnAudit && text.includes('INSERT INTO audit_events')) throw new Error('synthetic audit write failure');
    if (text.includes('INSERT INTO signals')) {
      const row = {
        id: '9dfe2db1-8b0e-4cbd-bf12-c4fdbf01d3d1', organization_id: '1dfe2db1-8b0e-4cbd-bf12-c4fdbf01d3d1',
        submitted_by: '2dfe2db1-8b0e-4cbd-bf12-c4fdbf01d3d1', client_submission_id: input.clientSubmissionId,
        category: input.category, summary: input.summary, source_type: input.sourceType,
        observed_at: new Date(input.observedAt), administrative_area_code: input.location.administrativeAreaCode,
        location_precision: input.location.precision, status: 'submitted', version: 1, created_at: new Date('2026-10-11T08:31:00Z')
      };
      return { rows: [row as Row], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }
  release(): void { this.released = true; }
}

class FakePool implements SqlPool {
  readonly connection: FakeConnection;
  constructor(failOnAudit = false) { this.connection = new FakeConnection(failOnAudit); }
  async connect(): Promise<SqlConnection> { return this.connection; }
}

describe('PostgresSignalStore transaction contract', () => {
  it('sets tenant scope and writes the signal and audit event in one transaction', async () => {
    const pool = new FakePool();
    const store = new PostgresSignalStore(pool);
    const result = await store.createIdempotent({ userId: '2dfe2db1-8b0e-4cbd-bf12-c4fdbf01d3d1', organizationId: '1dfe2db1-8b0e-4cbd-bf12-c4fdbf01d3d1', roles: ['reviewer'] }, input);
    expect(result.kind).toBe('created');
    expect(pool.connection.calls[0]?.text).toBe('BEGIN');
    expect(pool.connection.calls.some((call) => call.text.includes("set_config('app.organization_id'"))).toBe(true);
    expect(pool.connection.calls.some((call) => call.text.includes('INSERT INTO audit_events'))).toBe(true);
    expect(pool.connection.calls.at(-1)?.text).toBe('COMMIT');
    expect(pool.connection.released).toBe(true);
  });
});


describe('PostgresSignalStore failure handling', () => {
  it('rolls back when the audit write fails and always releases the connection', async () => {
    const pool = new FakePool(true);
    const store = new PostgresSignalStore(pool);
    await expect(store.createIdempotent({ userId: '2dfe2db1-8b0e-4cbd-bf12-c4fdbf01d3d1', organizationId: '1dfe2db1-8b0e-4cbd-bf12-c4fdbf01d3d1', roles: ['reviewer'] }, input)).rejects.toThrow('synthetic audit write failure');
    expect(pool.connection.calls.at(-1)?.text).toBe('ROLLBACK');
    expect(pool.connection.released).toBe(true);
  });
});
