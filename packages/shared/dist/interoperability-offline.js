import { z } from 'zod';
export const FhirExchangeProfileSchema = z.object({
    resourceType: z.literal('Bundle'),
    profile: z.string().url(),
    type: z.enum(['collection', 'batch']),
    entryCount: z.number().int().nonnegative()
}).strict();
function csvEscape(value) {
    return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
/** Deterministic UTF-8 CSV representation for low-connectivity/offline exchange. */
export function serializeAggregateCsv(records) {
    const header = 'indicator_code,administrative_unit_code,period,value,cell_count';
    const rows = [...records]
        .sort((a, b) => `${a.indicatorCode}|${a.administrativeUnitCode}|${a.period}`.localeCompare(`${b.indicatorCode}|${b.administrativeUnitCode}|${b.period}`))
        .map(r => [r.indicatorCode, r.administrativeUnitCode, r.period, r.value === null ? '' : String(r.value), String(r.cellCount)].map(csvEscape).join(','));
    return [header, ...rows].join('\n') + '\n';
}
export function parseAggregateCsv(input) {
    const normalized = input.replaceAll('\r\n', '\n').replaceAll('\r', '\n').trimEnd();
    const lines = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < normalized.length; i += 1) {
        const ch = normalized[i];
        if (quoted) {
            if (ch === '"' && normalized[i + 1] === '"') {
                field += '"';
                i += 1;
            }
            else if (ch === '"')
                quoted = false;
            else
                field += ch;
        }
        else if (ch === '"' && field === '')
            quoted = true;
        else if (ch === ',') {
            row.push(field);
            field = '';
        }
        else if (ch === '\n') {
            row.push(field);
            lines.push(row);
            row = [];
            field = '';
        }
        else
            field += ch;
    }
    if (quoted)
        throw new Error('invalid_aggregate_csv_quote');
    row.push(field);
    if (row.length > 1 || row[0] !== '')
        lines.push(row);
    if (!lines.length || lines[0].join(',') !== 'indicator_code,administrative_unit_code,period,value,cell_count')
        throw new Error('invalid_aggregate_csv_header');
    return lines.slice(1).map(fields => {
        if (fields.length !== 5)
            throw new Error('invalid_aggregate_csv_row');
        const [indicatorCode, administrativeUnitCode, period, value, cellCount] = fields;
        const parsedCellCount = Number(cellCount);
        if (!indicatorCode || !administrativeUnitCode || !period || !Number.isInteger(parsedCellCount) || parsedCellCount < 0)
            throw new Error('invalid_aggregate_csv_value');
        const parsedValue = value === '' ? null : Number(value);
        if (parsedValue !== null && !Number.isFinite(parsedValue))
            throw new Error('invalid_aggregate_csv_numeric_value');
        return { indicatorCode, administrativeUnitCode, period, value: parsedValue, cellCount: parsedCellCount };
    });
}
