import type { VerifiedActor } from './signal-store.js';
import type { CountryConfig, DataSharingPolicy, IndicatorDefinition, IntegrationProfile, ProgrammeConfig, InteroperabilityContract, ExchangeReceipt, ReconciliationSnapshotInput } from '@publipulse/shared';

export interface InteroperabilityStore {
  listCountries(): Promise<CountryConfig[]>;
  listProgrammes(actor: VerifiedActor): Promise<ProgrammeConfig[]>;
  listIndicators(countryCode?: string): Promise<IndicatorDefinition[]>;
  listSharingPolicies(actor: VerifiedActor): Promise<DataSharingPolicy[]>;
  createSharingPolicy(actor: VerifiedActor, policy: DataSharingPolicy): Promise<DataSharingPolicy>;
  listIntegrationProfiles(actor: VerifiedActor): Promise<IntegrationProfile[]>;
  requestExchange(actor: VerifiedActor, contract: InteroperabilityContract, idempotencyKey: string): Promise<ExchangeReceipt>;
  recordReconciliation(actor: VerifiedActor, input: ReconciliationSnapshotInput): Promise<{ id: string; exchangeJobId: string; provider: string; status: string; countDelta: number; delta: number | null; reason: string }>;
}

export function canReadInteroperability(actor: VerifiedActor): boolean {
  return actor.roles.some(r => ['owner','administrator','reviewer','investigator','responder','analyst','read_only','auditor'].includes(r));
}
export function canManageSharingPolicy(actor: VerifiedActor): boolean {
  return actor.roles.some(r => ['owner','administrator'].includes(r));
}
