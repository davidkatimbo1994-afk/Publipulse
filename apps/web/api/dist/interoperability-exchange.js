export function requiredCapability(contract) {
    if (contract.mode === 'metadata')
        return 'metadata_sync';
    return contract.direction === 'export' ? 'aggregate_export' : 'indicator_import';
}
export function validateExchangeContract(input) {
    const { contract, profile, policies, mappedIndicatorCodes } = input;
    if (!profile)
        return { allowed: false, code: 'profile_missing', reason: 'No integration profile is available for this exchange.' };
    if (profile.provider !== contract.provider)
        return { allowed: false, code: 'profile_missing', reason: 'Integration profile provider does not match the contract provider.' };
    if (profile.status !== 'verified')
        return { allowed: false, code: 'profile_not_verified', reason: 'External integration is not verified.' };
    const capability = requiredCapability(contract);
    if (!profile.capabilities.includes(capability))
        return { allowed: false, code: 'capability_missing', reason: `Integration profile lacks ${capability}.` };
    const policy = policies.find(p => p.active && (contract.programmeCode ? p.programmeId !== null : p.programmeId === null));
    if (!policy)
        return { allowed: false, code: 'policy_missing', reason: 'No applicable active sharing policy exists.' };
    if (contract.crossBorder && !policy.allowCrossBorder)
        return { allowed: false, code: 'cross_border_not_allowed', reason: 'Cross-border exchange is not permitted by the applicable policy.' };
    for (const code of contract.indicatorCodes) {
        if (!policy.allowedIndicatorCodes.includes(code))
            return { allowed: false, code: 'indicator_not_allowed', reason: `Indicator ${code} is outside the sharing policy.` };
        if (!mappedIndicatorCodes.includes(code))
            return { allowed: false, code: 'mapping_missing', reason: `Indicator ${code} has no active country mapping.` };
    }
    return { allowed: true };
}
export function nextRetryAt(now, attempt, baseDelayMs = 5000, maxDelayMs = 300000) {
    const safeAttempt = Math.max(0, Math.floor(attempt));
    const delay = Math.min(maxDelayMs, baseDelayMs * (2 ** safeAttempt));
    return new Date(now.getTime() + delay);
}
