export const fmtDate = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
export const text = (v: unknown, fallback = '—') => typeof v === 'string' && v.trim() ? v : fallback;
export const resultLabel = (v: unknown) => text(v, 'unknown').replaceAll('_', ' ');
