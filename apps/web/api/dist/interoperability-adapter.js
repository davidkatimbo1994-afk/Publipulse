/**
 * Deliberately disabled transport used until a controlled external test environment exists.
 * It makes accidental production calls impossible.
 */
export class DisabledInteroperabilityAdapter {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    async execute(_contract) {
        throw new Error('transport_disabled');
    }
}
export function asTransport(adapter) {
    return { execute: (contract) => adapter.execute(contract) };
}
