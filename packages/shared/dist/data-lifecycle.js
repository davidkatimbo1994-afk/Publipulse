import { z } from 'zod';
export const DataClassSchema = z.enum(['operational', 'outcome_evidence', 'interoperability_evidence', 'audit']);
export const RetentionPolicySchema = z.object({
    dataClass: DataClassSchema,
    retentionDays: z.number().int().min(1).max(36500),
    active: z.boolean()
});
export function evaluateRetention(input) {
    const policy = RetentionPolicySchema.parse(input.policy);
    const created = new Date(input.createdAt);
    const now = new Date(input.now);
    if (!Number.isFinite(created.getTime()) || !Number.isFinite(now.getTime()))
        throw new Error('invalid_timestamp');
    if (created.getTime() > now.getTime())
        throw new Error('created_at_in_future');
    const cutoff = new Date(now.getTime() - policy.retentionDays * 24 * 60 * 60 * 1000);
    if (input.legalHold)
        return { disposition: 'held', cutoffAt: cutoff.toISOString(), reason: 'legal_hold' };
    if (!policy.active || created.getTime() >= cutoff.getTime())
        return { disposition: 'retain', cutoffAt: cutoff.toISOString(), reason: 'within_retention' };
    return { disposition: 'eligible_for_review', cutoffAt: cutoff.toISOString(), reason: 'retention_elapsed' };
}
export function assertDispositionReviewRequired(decision) {
    if (decision.disposition === 'eligible_for_review') {
        throw new Error('retention_disposition_requires_review');
    }
}
export function retentionCutoff(now, retentionDays) {
    if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 36500)
        throw new Error('invalid_retention_days');
    const date = new Date(now);
    if (!Number.isFinite(date.getTime()))
        throw new Error('invalid_timestamp');
    return new Date(date.getTime() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
}
