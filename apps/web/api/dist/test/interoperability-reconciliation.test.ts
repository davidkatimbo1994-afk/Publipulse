import { describe, expect, it } from 'vitest';
import { reconcileExchange } from '@publipulse/shared/interoperability-reconciliation';

describe('interoperability reconciliation', () => {
  it('marks identical counts and totals exact', () => {
    expect(reconcileExchange({ localRecordCount: 10, externalRecordCount: 10, localTotal: 100, externalTotal: 100, tolerance: 0 })).toMatchObject({ status: 'exact', countDelta: 0, delta: 0 });
  });
  it('allows a declared numeric tolerance but never hides count drift', () => {
    expect(reconcileExchange({ localRecordCount: 10, externalRecordCount: 10, localTotal: 100, externalTotal: 100.5, tolerance: 1 })).toMatchObject({ status: 'within_tolerance', countDelta: 0 });
    expect(reconcileExchange({ localRecordCount: 10, externalRecordCount: 11, localTotal: 100, externalTotal: 100, tolerance: 1 })).toMatchObject({ status: 'mismatch', countDelta: 1 });
  });
  it('does not treat missing totals as zero', () => {
    expect(reconcileExchange({ localRecordCount: 10, externalRecordCount: 10, localTotal: null, externalTotal: null, tolerance: 0 })).toMatchObject({ status: 'not_comparable', delta: null });
  });
  it('marks differing counts without totals as mismatch', () => {
    expect(reconcileExchange({ localRecordCount: 10, externalRecordCount: 9, tolerance: 0 })).toMatchObject({ status: 'mismatch', countDelta: -1 });
  });
});
