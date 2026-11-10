import { z } from 'zod';
export declare const SevenOneSevenSchema: z.ZodObject<{
    detectedAt: z.ZodString;
    notifiedAt: z.ZodNullable<z.ZodString>;
    responseStartedAt: z.ZodNullable<z.ZodString>;
    outcomeMeasuredAt: z.ZodNullable<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    detectedAt: string;
    notifiedAt: string | null;
    responseStartedAt: string | null;
    outcomeMeasuredAt: string | null;
}, {
    detectedAt: string;
    notifiedAt: string | null;
    responseStartedAt: string | null;
    outcomeMeasuredAt: string | null;
}>;
export type SevenOneSevenInput = z.infer<typeof SevenOneSevenSchema>;
export declare function sevenOneSevenClocks(input: SevenOneSevenInput): {
    detectionToNotificationHours: number | null;
    notificationToResponseHours: number | null;
    detectionToResponseHours: number | null;
    detectionToMeasuredOutcomeHours: number | null;
    outcomeCompleteness: boolean;
};
