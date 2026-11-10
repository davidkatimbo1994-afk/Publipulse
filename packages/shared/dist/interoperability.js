import { z } from 'zod';
export const CountryCodeSchema = z.string().regex(/^[A-Z]{2}$/, 'country code must be ISO 3166-1 alpha-2');
export const ProgrammeCodeSchema = z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9._-]+$/);
export const IndicatorCodeSchema = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9._:-]+$/);
export const CountryConfigSchema = z.object({
    countryCode: CountryCodeSchema,
    name: z.string().trim().min(2).max(160),
    defaultLanguage: z.string().trim().min(2).max(40),
    timezone: z.string().trim().min(1).max(80),
    administrativeLevels: z.array(z.object({
        level: z.number().int().min(0).max(10),
        codeSystem: z.string().trim().min(1).max(80),
        label: z.string().trim().min(1).max(120)
    }).strict()).min(1).max(10)
}).strict();
export const ProgrammeConfigSchema = z.object({
    countryCode: CountryCodeSchema,
    code: ProgrammeCodeSchema,
    name: z.string().trim().min(2).max(160),
    status: z.enum(['draft', 'active', 'suspended', 'retired']),
    configuration: z.record(z.unknown()).default({})
}).strict();
export const IndicatorDefinitionSchema = z.object({
    code: IndicatorCodeSchema,
    name: z.string().trim().min(2).max(240),
    description: z.string().trim().min(3).max(2000),
    unit: z.string().trim().max(80).nullable().optional(),
    aggregation: z.enum(['count', 'rate', 'ratio', 'proportion', 'percentage', 'index', 'other']),
    numeratorDefinition: z.string().trim().max(2000).nullable().optional(),
    denominatorDefinition: z.string().trim().max(2000).nullable().optional(),
    sourceStandard: z.string().trim().max(240).nullable().optional(),
    standardVersion: z.string().trim().max(80).nullable().optional()
}).strict();
export const DataSharingPolicySchema = z.object({
    programmeId: z.string().uuid().nullable().optional(),
    classification: z.enum(['aggregate', 'operational', 'sensitive']),
    purpose: z.string().trim().min(3).max(500),
    destinationType: z.enum(['same_organization', 'authorized_programme', 'authorized_country_system', 'external_system']),
    allowedIndicatorCodes: z.array(IndicatorCodeSchema).max(500),
    minimumCellSize: z.number().int().min(1).max(100000).default(5),
    allowCrossBorder: z.boolean().default(false),
    active: z.boolean().default(true)
}).strict();
export const IntegrationProfileSchema = z.object({
    id: z.string().uuid().optional(),
    provider: z.enum(['dhis2', 'csv', 'fhir', 'other']),
    name: z.string().trim().min(2).max(160),
    status: z.enum(['planned', 'configured', 'verification_pending', 'verified', 'disabled']),
    baseUrl: z.string().url().refine(v => new URL(v).protocol === 'https:', 'integration base URL must use HTTPS').optional(),
    capabilities: z.array(z.enum(['indicator_import', 'aggregate_export', 'metadata_sync', 'org_unit_mapping'])).max(20),
    notes: z.string().trim().max(1000).optional()
}).strict();
