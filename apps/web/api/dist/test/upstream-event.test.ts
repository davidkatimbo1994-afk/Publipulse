import { describe, expect, it } from 'vitest';
import { Dhis2UpstreamEventSchema, normalizeDhis2UpstreamEvent } from '@publipulse/shared';

describe('upstream DHIS2 event boundary', () => {
  it('normalizes only bounded event metadata into the provider-neutral contract', () => {
    const input = { integrationProfileId:'00000000-0000-4000-8000-000000000001', provider:'dhis2', externalEventId:'evt-42', contractVersion:'1.0', program:'EBS', orgUnit:'D01', occurredAt:'2026-10-16T08:00:00Z', category:'unusual_illness', summary:'Unusual cluster reported by a facility', sourceType:'facility_report' } as const;
    const parsed=Dhis2UpstreamEventSchema.parse(input);
    const normalized=normalizeDhis2UpstreamEvent(parsed);
    expect(normalized.provider).toBe('dhis2');
    expect(normalized.externalEventId).toBe('evt-42');
    expect(normalized.location.precision).toBe('district');
  });
  it('rejects direct identifiers in upstream narrative', () => {
    const input={integrationProfileId:'00000000-0000-4000-8000-000000000001',provider:'dhis2',externalEventId:'evt-43',contractVersion:'1.0',program:'EBS',orgUnit:'D01',occurredAt:'2026-10-16T08:00:00Z',category:'other',summary:'Call 0700123456 about the event',sourceType:'facility_report'};
    expect(Dhis2UpstreamEventSchema.safeParse(input).success).toBe(false);
  });
});
