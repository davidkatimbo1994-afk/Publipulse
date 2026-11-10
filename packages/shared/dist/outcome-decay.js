import { z } from 'zod';
export const OutcomeDecayStageSchema = z.enum(['signal', 'verified', 'owned', 'acted', 'measured', 'durable']);
export function outcomeCompleteness(snapshot) {
    const denominator = Math.max(snapshot.signalCount, 1);
    return {
        verified: Number((snapshot.verifiedCount / denominator).toFixed(4)),
        owned: Number((snapshot.ownedCount / denominator).toFixed(4)),
        acted: Number((snapshot.actedCount / denominator).toFixed(4)),
        measured: Number((snapshot.measuredCount / denominator).toFixed(4)),
        durable: Number((snapshot.durableCount / denominator).toFixed(4))
    };
}
export function validateMinimumCell(minCell) {
    if (!Number.isInteger(minCell) || minCell < 1 || minCell > 1000)
        throw new Error('minCell must be an integer between 1 and 1000');
    return minCell;
}
