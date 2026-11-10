import { z } from 'zod';
export const ReconciliationStatusSchema = z.enum(['exact', 'within_tolerance', 'mismatch', 'not_comparable']);
export const ReconciliationInputSchema = z.object({
    localRecordCount: z.number().int().nonnegative(),
    externalRecordCount: z.number().int().nonnegative(),
    localTotal: z.number().finite().nullable().optional(),
    externalTotal: z.number().finite().nullable().optional(),
    tolerance: z.number().finite().nonnegative().default(0)
}).strict();
export const ReconciliationSnapshotInputSchema = z.object({
    exchangeJobId: z.string().uuid(),
    provider: z.enum(['dhis2', 'fhir', 'csv', 'other']),
    externalRecordCount: z.number().int().nonnegative(),
    externalTotal: z.number().finite().nullable().optional(),
    tolerance: z.number().finite().nonnegative().default(0),
    evidenceDigest: z.string().trim().min(16).max(200).optional()
}).strict();
/**
 * Reconciliation is deliberately conservative. Missing totals are not treated as zero,
 * and any count mismatch remains visible even when totals happen to match.
 */
export function reconcileExchange(input) {
    const parsed = ReconciliationInputSchema.parse(input);
    const countDelta = parsed.externalRecordCount - parsed.localRecordCount;
    const hasTotals = parsed.localTotal !== null && parsed.localTotal !== undefined && parsed.externalTotal !== null && parsed.externalTotal !== undefined;
    if (!hasTotals) {
        return {
            status: countDelta === 0 ? 'not_comparable' : 'mismatch',
            countDelta,
            delta: null,
            reason: countDelta === 0 ? 'Record counts match, but comparable totals were not supplied.' : 'Record counts differ and comparable totals were not supplied.'
        };
    }
    const delta = Number(parsed.externalTotal) - Number(parsed.localTotal);
    const totalsMatch = Math.abs(delta) <= parsed.tolerance;
    if (countDelta === 0 && delta === 0)
        return { status: 'exact', countDelta, delta, reason: 'Record counts and totals match exactly.' };
    if (countDelta === 0 && totalsMatch)
        return { status: 'within_tolerance', countDelta, delta, reason: 'Record counts match and total difference is within the declared tolerance.' };
    return { status: 'mismatch', countDelta, delta, reason: 'Record counts or totals differ beyond the declared tolerance.' };
}
export function evidenceDigestInput(parts) {
    return parts.map(part => part.trim()).filter(Boolean).join('|');
}
