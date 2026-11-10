import { z } from 'zod';
export declare const OutcomeDecayStageSchema: z.ZodEnum<["signal", "verified", "owned", "acted", "measured", "durable"]>;
export type OutcomeDecayStage = z.infer<typeof OutcomeDecayStageSchema>;
export type OutcomeDecaySnapshot = {
    signalCount: number;
    verifiedCount: number;
    ownedCount: number;
    actedCount: number;
    measuredCount: number;
    durableCount: number;
    medianHoursToVerified: number | null;
    medianHoursToOwned: number | null;
    medianHoursToActed: number | null;
    medianHoursToMeasured: number | null;
    medianHoursToDurable: number | null;
    dropoutReasons: Array<{
        code: string;
        count: number;
    }>;
};
export declare function outcomeCompleteness(snapshot: Pick<OutcomeDecaySnapshot, 'signalCount' | 'verifiedCount' | 'ownedCount' | 'actedCount' | 'measuredCount' | 'durableCount'>): {
    verified: number;
    owned: number;
    acted: number;
    measured: number;
    durable: number;
};
export declare function validateMinimumCell(minCell: number): number;
