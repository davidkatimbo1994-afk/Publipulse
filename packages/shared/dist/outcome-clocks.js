import { z } from 'zod';
export const SevenOneSevenSchema = z.object({
    detectedAt: z.string().datetime({ offset: true }),
    notifiedAt: z.string().datetime({ offset: true }).nullable(),
    responseStartedAt: z.string().datetime({ offset: true }).nullable(),
    outcomeMeasuredAt: z.string().datetime({ offset: true }).nullable()
}).strict();
export function sevenOneSevenClocks(input) {
    const detected = Date.parse(input.detectedAt);
    const delta = (value, start) => value ? Math.max(0, (Date.parse(value) - start) / 3600000) : null;
    return {
        detectionToNotificationHours: delta(input.notifiedAt, detected),
        notificationToResponseHours: input.notifiedAt ? delta(input.responseStartedAt, Date.parse(input.notifiedAt)) : null,
        detectionToResponseHours: delta(input.responseStartedAt, detected),
        detectionToMeasuredOutcomeHours: delta(input.outcomeMeasuredAt, detected),
        outcomeCompleteness: input.outcomeMeasuredAt !== null
    };
}
