import type { Dhis2MetadataSnapshot, Dhis2IndicatorMapping, Dhis2OrgUnitMapping, MappingDrift } from '@publipulse/shared/dhis2-metadata';
import { Dhis2MetadataSnapshotSchema, compareIndicatorMapping, compareOrgUnitMapping, findDuplicateMappings } from '@publipulse/shared/dhis2-metadata';

export type MetadataReconciliation = {
  status: 'aligned' | 'drift_detected' | 'invalid_snapshot';
  checkedIndicators: number;
  checkedOrgUnits: number;
  drift: MappingDrift[];
};

export function reconcileDhis2Metadata(input: {
  snapshot: unknown;
  indicatorMappings: readonly Dhis2IndicatorMapping[];
  orgUnitMappings: readonly Dhis2OrgUnitMapping[];
}): MetadataReconciliation {
  const parsed = Dhis2MetadataSnapshotSchema.safeParse(input.snapshot);
  if (!parsed.success) return { status: 'invalid_snapshot', checkedIndicators: 0, checkedOrgUnits: 0, drift: [{ kind: 'indicator_missing', key: 'snapshot', detail: 'DHIS2 metadata snapshot failed schema validation.' }] };
  const drift = [
    ...findDuplicateMappings(input.indicatorMappings),
    ...input.indicatorMappings.flatMap(mapping => compareIndicatorMapping(mapping, parsed.data)),
    ...input.orgUnitMappings.flatMap(mapping => compareOrgUnitMapping(mapping, parsed.data))
  ];
  return { status: drift.length ? 'drift_detected' : 'aligned', checkedIndicators: input.indicatorMappings.length, checkedOrgUnits: input.orgUnitMappings.length, drift };
}
