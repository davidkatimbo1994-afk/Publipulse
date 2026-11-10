import { z } from 'zod';
export declare function findDirectIdentifierPattern(value: string): string | null;
export declare function publicHealthNarrative<T extends z.ZodTypeAny>(schema: T): z.ZodEffects<T, z.output<T>, z.input<T>>;
export declare function assertPublicHealthNarrative(value: string): void;
