import type { ExchangeTransport, InteroperabilityContract } from '@publipulse/shared';

/**
 * Provider adapter boundary. Implementations must perform the external call only after
 * the API has verified the contract, sharing policy, tenant and integration profile.
 */
export interface InteroperabilityAdapter {
  readonly provider: InteroperabilityContract['provider'];
  execute(contract: InteroperabilityContract): Promise<{ externalReference?: string }>;
}

/**
 * Deliberately disabled transport used until a controlled external test environment exists.
 * It makes accidental production calls impossible.
 */
export class DisabledInteroperabilityAdapter implements InteroperabilityAdapter {
  constructor(readonly provider: InteroperabilityContract['provider']) {}
  async execute(_contract: InteroperabilityContract): Promise<{ externalReference?: string }> {
    throw new Error('transport_disabled');
  }
}

export function asTransport(adapter: InteroperabilityAdapter): ExchangeTransport {
  return { execute: (contract) => adapter.execute(contract) };
}
