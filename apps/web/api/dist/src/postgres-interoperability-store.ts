import type { CountryConfig, DataSharingPolicy, IndicatorDefinition, IntegrationProfile, ProgrammeConfig, InteroperabilityContract, ExchangeReceipt, ReconciliationSnapshotInput } from '@publipulse/shared';
import { stableContractFingerprint } from '@publipulse/shared';
import { validateExchangeContract } from './interoperability-exchange.js';
import type { InteroperabilityStore } from './interoperability-store.js';
import type { SqlPool } from './postgres-signal-store.js';
import type { VerifiedActor } from './signal-store.js';

export class PostgresInteroperabilityStore implements InteroperabilityStore {
  constructor(private readonly pool: SqlPool) {}

  async listCountries(): Promise<CountryConfig[]> {
    const c = await this.pool.connect();
    try {
      const r = await c.query<any>(`SELECT country_code,name,default_language,timezone,administrative_levels FROM country_configs WHERE active=true ORDER BY name`);
      return r.rows.map(x => ({ countryCode:x.country_code, name:x.name, defaultLanguage:x.default_language, timezone:x.timezone, administrativeLevels:x.administrative_levels }));
    } finally { c.release(); }
  }

  async listProgrammes(actor: VerifiedActor): Promise<ProgrammeConfig[]> {
    const c=await this.pool.connect();
    try {
      await c.query('BEGIN READ ONLY'); await c.query("SELECT set_config('app.organization_id',$1,true)",[actor.organizationId]);
      const r=await c.query<any>(`SELECT country_code,code,name,status,configuration FROM programmes WHERE organization_id=$1 ORDER BY name`,[actor.organizationId]);
      await c.query('COMMIT');
      return r.rows.map(x=>({countryCode:x.country_code,code:x.code,name:x.name,status:x.status,configuration:x.configuration}));
    } catch(e){try{await c.query('ROLLBACK')}catch{};throw e} finally{c.release()}
  }

  async listIndicators(countryCode?: string): Promise<IndicatorDefinition[]> {
    const c=await this.pool.connect();
    try {
      const r=await c.query<any>(countryCode
        ? `SELECT i.code,i.name,i.description,i.unit,i.aggregation,i.numerator_definition,i.denominator_definition,i.source_standard,i.standard_version FROM indicator_definitions i JOIN country_indicator_mappings m ON m.indicator_code=i.code WHERE i.active=true AND m.country_code=$1 AND m.active=true ORDER BY i.code`
        : `SELECT code,name,description,unit,aggregation,numerator_definition,denominator_definition,source_standard,standard_version FROM indicator_definitions WHERE active=true ORDER BY code`,
        countryCode ? [countryCode] : []);
      return r.rows.map(x=>({code:x.code,name:x.name,description:x.description,unit:x.unit,aggregation:x.aggregation,numeratorDefinition:x.numerator_definition,denominatorDefinition:x.denominator_definition,sourceStandard:x.source_standard,standardVersion:x.standard_version}));
    } finally { c.release(); }
  }

  async listSharingPolicies(actor: VerifiedActor): Promise<DataSharingPolicy[]> {
    const c=await this.pool.connect();
    try {
      await c.query('BEGIN READ ONLY'); await c.query("SELECT set_config('app.organization_id',$1,true)",[actor.organizationId]);
      const r=await c.query<any>(`SELECT programme_id,classification,purpose,destination_type,allowed_indicator_codes,minimum_cell_size,allow_cross_border,active FROM data_sharing_policies WHERE organization_id=$1 ORDER BY created_at DESC`,[actor.organizationId]);
      await c.query('COMMIT');
      return r.rows.map(x=>({programmeId:x.programme_id,classification:x.classification,purpose:x.purpose,destinationType:x.destination_type,allowedIndicatorCodes:x.allowed_indicator_codes,minimumCellSize:x.minimum_cell_size,allowCrossBorder:x.allow_cross_border,active:x.active}));
    } catch(e){try{await c.query('ROLLBACK')}catch{};throw e} finally{c.release()}
  }

  async createSharingPolicy(actor: VerifiedActor, policy: DataSharingPolicy): Promise<DataSharingPolicy> {
    const c=await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query("SELECT set_config('app.organization_id',$1,true)",[actor.organizationId]);
      if (policy.programmeId) {
        const p=await c.query(`SELECT 1 FROM programmes WHERE organization_id=$1 AND id=$2`,[actor.organizationId,policy.programmeId]);
        if (!p.rows[0]) { await c.query('ROLLBACK'); throw new Error('programme_not_found'); }
      }
      const r=await c.query<any>(`INSERT INTO data_sharing_policies (organization_id,programme_id,classification,purpose,destination_type,allowed_indicator_codes,minimum_cell_size,allow_cross_border,active,created_by)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)
        RETURNING programme_id,classification,purpose,destination_type,allowed_indicator_codes,minimum_cell_size,allow_cross_border,active`,
        [actor.organizationId,policy.programmeId??null,policy.classification,policy.purpose,policy.destinationType,JSON.stringify(policy.allowedIndicatorCodes),policy.minimumCellSize,policy.allowCrossBorder,policy.active,actor.userId]);
      await c.query(`INSERT INTO audit_events (organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'governance.sharing_policy_created','data_sharing_policy',NULL,'success',$3::jsonb)`,
        [actor.organizationId,actor.userId,JSON.stringify({classification:policy.classification,destinationType:policy.destinationType,indicatorCount:policy.allowedIndicatorCodes.length,allowCrossBorder:policy.allowCrossBorder})]);
      await c.query('COMMIT');
      const x=r.rows[0];
      return {programmeId:x.programme_id,classification:x.classification,purpose:x.purpose,destinationType:x.destination_type,allowedIndicatorCodes:x.allowed_indicator_codes,minimumCellSize:x.minimum_cell_size,allowCrossBorder:x.allow_cross_border,active:x.active};
    } catch(e){try{await c.query('ROLLBACK')}catch{};throw e} finally{c.release()}
  }

  async listIntegrationProfiles(actor: VerifiedActor): Promise<IntegrationProfile[]> {
    const c=await this.pool.connect();
    try {
      await c.query('BEGIN READ ONLY'); await c.query("SELECT set_config('app.organization_id',$1,true)",[actor.organizationId]);
      const r=await c.query<any>(`SELECT id,provider,name,status,base_url,capabilities,notes FROM integration_profiles WHERE organization_id=$1 ORDER BY name`,[actor.organizationId]);
      await c.query('COMMIT');
      return r.rows.map(x=>({id:x.id,provider:x.provider,name:x.name,status:x.status,baseUrl:x.base_url??undefined,capabilities:x.capabilities,notes:x.notes??undefined}));
    } catch(e){try{await c.query('ROLLBACK')}catch{};throw e} finally{c.release()}
  }

  async requestExchange(actor: VerifiedActor, contract: InteroperabilityContract, idempotencyKey: string): Promise<ExchangeReceipt> {
    const c=await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query("SELECT set_config('app.organization_id',$1,true)",[actor.organizationId]);
      const prior=await c.query<any>(`SELECT j.id,j.status,j.provider,j.idempotency_key,j.contract_fingerprint,j.external_reference,r.status AS receipt_status,r.contract_version,r.received_at,r.message
        FROM interoperability_exchange_jobs j LEFT JOIN interoperability_exchange_receipts r ON r.exchange_job_id=j.id
        WHERE j.organization_id=$1 AND j.idempotency_key=$2`,[actor.organizationId,idempotencyKey]);
      if (prior.rows[0]) {
        const x=prior.rows[0];
        const fingerprint=stableContractFingerprint(contract);
        if (x.contract_fingerprint !== fingerprint) {
          await c.query('ROLLBACK');
          throw new Error('idempotency_conflict');
        }
        await c.query('COMMIT');
        return {exchangeId:x.id,status:x.receipt_status ?? (x.status==='rejected'?'rejected':'accepted'),provider:x.provider,contractVersion:x.contract_version ?? '1.0',idempotencyKey:x.idempotency_key,externalReference:x.external_reference??undefined,receivedAt:new Date(x.received_at ?? Date.now()).toISOString(),message:x.message??undefined};
      }

      const profileResult=await c.query<any>(`SELECT id,provider,name,status,base_url,capabilities,notes FROM integration_profiles WHERE organization_id=$1 AND id=$2`,[actor.organizationId,contract.integrationProfileId]);
      const profile=profileResult.rows[0] ? {id:profileResult.rows[0].id,provider:profileResult.rows[0].provider,name:profileResult.rows[0].name,status:profileResult.rows[0].status,baseUrl:profileResult.rows[0].base_url??undefined,capabilities:profileResult.rows[0].capabilities,notes:profileResult.rows[0].notes??undefined} as IntegrationProfile : null;
      let programmeId: string | null = null;
      if (contract.programmeCode) {
        const programme=await c.query<any>(`SELECT id FROM programmes WHERE organization_id=$1 AND country_code=$2 AND code=$3`,[actor.organizationId,contract.countryCode,contract.programmeCode]);
        if (!programme.rows[0]) { await c.query('ROLLBACK'); throw new Error('programme_not_found'); }
        programmeId=programme.rows[0].id;
      }
      const policyRows=await c.query<any>(`SELECT programme_id,classification,purpose,destination_type,allowed_indicator_codes,minimum_cell_size,allow_cross_border,active FROM data_sharing_policies WHERE organization_id=$1 AND active=true`,[actor.organizationId]);
      const policies: DataSharingPolicy[]=policyRows.rows.map(x=>({programmeId:x.programme_id,classification:x.classification,purpose:x.purpose,destinationType:x.destination_type,allowedIndicatorCodes:x.allowed_indicator_codes,minimumCellSize:x.minimum_cell_size,allowCrossBorder:x.allow_cross_border,active:x.active}));
      const applicablePolicies=policies.filter(p => (programmeId ? p.programmeId === programmeId : p.programmeId === null));
      const mapped=await c.query<any>(`SELECT indicator_code,mapping_version FROM country_indicator_mappings WHERE country_code=$1 AND active=true AND indicator_code = ANY($2::text[])`,[contract.countryCode,contract.indicatorCodes]);
      const mappedCodes=mapped.rows.map(x=>x.indicator_code);
      const mappingVersions=new Set(mapped.rows.map(x=>x.mapping_version));
      if (mapped.rows.length !== contract.indicatorCodes.length || mappingVersions.size !== 1 || !mappingVersions.has(contract.mappingVersion)) {
        const rejection={code:'mapping_missing' as const,reason:'Indicator mapping is missing or its version does not match the exchange contract.'};
        const insert=await c.query<any>(`INSERT INTO interoperability_exchange_jobs (organization_id,integration_profile_id,provider,direction,mode,country_code,programme_code,indicator_codes,mapping_version,administrative_unit_mapping_version,purpose,cross_border,idempotency_key,contract_fingerprint,status,rejection_code,created_by)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,'rejected',$15,$16) RETURNING id`,[actor.organizationId,contract.integrationProfileId,contract.provider,contract.direction,contract.mode,contract.countryCode,contract.programmeCode??null,JSON.stringify(contract.indicatorCodes),contract.mappingVersion,contract.administrativeUnitMappingVersion??null,contract.purpose,contract.crossBorder,idempotencyKey,stableContractFingerprint(contract),rejection.code,actor.userId]);
        const receipt=await c.query<any>(`INSERT INTO interoperability_exchange_receipts (organization_id,exchange_job_id,status,provider,contract_version,idempotency_key,message) VALUES($1,$2,'rejected',$3,'1.0',$4,$5) RETURNING received_at`,[actor.organizationId,insert.rows[0].id,contract.provider,idempotencyKey,rejection.reason]);
        await c.query('COMMIT');
        return {exchangeId:insert.rows[0].id,status:'rejected',provider:contract.provider,contractVersion:'1.0',idempotencyKey,receivedAt:new Date(receipt.rows[0].received_at).toISOString(),message:rejection.reason};
      }
      const validation=validateExchangeContract({contract,profile,policies:applicablePolicies,mappedIndicatorCodes:mappedCodes});
      const status='rejected' as const;
      const rejectionCode=validation.allowed ? 'transport_disabled' : validation.code;
      const message=validation.allowed ? 'Exchange contract authorized, but no external transport adapter is enabled.' : validation.reason;
      const insert=await c.query<any>(`INSERT INTO interoperability_exchange_jobs (organization_id,integration_profile_id,provider,direction,mode,country_code,programme_code,indicator_codes,mapping_version,administrative_unit_mapping_version,purpose,cross_border,idempotency_key,contract_fingerprint,status,rejection_code,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id,created_at`,[actor.organizationId,contract.integrationProfileId,contract.provider,contract.direction,contract.mode,contract.countryCode,contract.programmeCode??null,JSON.stringify(contract.indicatorCodes),contract.mappingVersion,contract.administrativeUnitMappingVersion??null,contract.purpose,contract.crossBorder,idempotencyKey,stableContractFingerprint(contract),status,rejectionCode,actor.userId]);
      const job=insert.rows[0];
      const receipt=await c.query<any>(`INSERT INTO interoperability_exchange_receipts (organization_id,exchange_job_id,status,provider,contract_version,idempotency_key,message) VALUES($1,$2,'rejected',$3,'1.0',$4,$5) RETURNING received_at`,[actor.organizationId,job.id,contract.provider,idempotencyKey,message]);
      await c.query(`INSERT INTO audit_events (organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'interoperability.exchange_rejected','interoperability_exchange_job',$3,'success',$4::jsonb)`,[actor.organizationId,actor.userId,job.id,JSON.stringify({code:rejectionCode,provider:contract.provider,direction:contract.direction,mode:contract.mode})]);
      await c.query('COMMIT');
      return {exchangeId:job.id,status:'rejected',provider:contract.provider,contractVersion:'1.0',idempotencyKey,receivedAt:new Date(receipt.rows[0].received_at).toISOString(),message};
    } catch(e){try{await c.query('ROLLBACK')}catch{};throw e} finally{c.release()}
  }


  async recordReconciliation(actor: VerifiedActor, input: ReconciliationSnapshotInput): Promise<{ id: string; exchangeJobId: string; provider: string; status: string; countDelta: number; delta: number | null; reason: string }> {
    const c=await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query("SELECT set_config('app.organization_id',$1,true)",[actor.organizationId]);
      const job=await c.query<any>(`SELECT id,provider,contract_fingerprint FROM interoperability_exchange_jobs WHERE organization_id=$1 AND id=$2 FOR SHARE`,[actor.organizationId,input.exchangeJobId]);
      if(!job.rows[0]) { await c.query('ROLLBACK'); throw new Error('exchange_job_not_found'); }
      if(job.rows[0].provider !== input.provider) { await c.query('ROLLBACK'); throw new Error('provider_mismatch'); }
      const prior=await c.query(`SELECT 1 FROM interoperability_reconciliation_snapshots WHERE organization_id=$1 AND exchange_job_id=$2`,[actor.organizationId,input.exchangeJobId]);
      if(prior.rows[0]) { await c.query('ROLLBACK'); throw new Error('reconciliation_already_recorded'); }
      const local=await c.query<any>(`SELECT COALESCE(jsonb_array_length(payload->'sourceRecordIds'),0)::bigint AS record_count, payload->>'total' AS total FROM interoperability_exchange_envelopes WHERE organization_id=$1 AND exchange_job_id=$2 ORDER BY created_at DESC LIMIT 1`,[actor.organizationId,input.exchangeJobId]);
      const localRecordCount=Number(local.rows[0]?.record_count ?? 0);
      const localTotal=local.rows[0]?.total==null ? null : Number(local.rows[0].total);
      const { reconcileExchange } = await import('@publipulse/shared');
      const result=reconcileExchange({localRecordCount,externalRecordCount:input.externalRecordCount,localTotal,externalTotal:input.externalTotal??null,tolerance:input.tolerance});
      const inserted=await c.query<any>(`INSERT INTO interoperability_reconciliation_snapshots(organization_id,exchange_job_id,provider,contract_fingerprint,local_record_count,external_record_count,local_total,external_total,tolerance,delta,status,evidence_digest,evaluated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,[actor.organizationId,input.exchangeJobId,input.provider,job.rows[0].contract_fingerprint,localRecordCount,input.externalRecordCount,localTotal,input.externalTotal??null,input.tolerance,result.delta,result.status,input.evidenceDigest??null,actor.userId]);
      await c.query(`INSERT INTO interoperability_provenance_events(organization_id,exchange_job_id,stage,direction,source_system,source_record_id,source_version,mapping_version,evidence_digest,created_by) SELECT $1,$2,'reconciled',j.direction,j.source_system,NULL,j.contract_version,j.mapping_version,$3,$4 FROM interoperability_exchange_jobs j WHERE j.organization_id=$1 AND j.id=$2`,[actor.organizationId,input.exchangeJobId,input.evidenceDigest??null,actor.userId]);
      await c.query(`INSERT INTO audit_events(organization_id,actor_user_id,action,resource_type,resource_id,outcome,metadata) VALUES($1,$2,'interoperability.reconciliation_recorded','interoperability_exchange_job',$3,'success',$4::jsonb)`,[actor.organizationId,actor.userId,input.exchangeJobId,JSON.stringify({provider:input.provider,status:result.status,countDelta:result.countDelta})]);
      await c.query('COMMIT');
      return {id:inserted.rows[0].id,exchangeJobId:input.exchangeJobId,provider:input.provider,status:result.status,countDelta:result.countDelta,delta:result.delta,reason:result.reason};
    } catch(e){try{await c.query('ROLLBACK')}catch{};throw e} finally{c.release()}
  }

}
