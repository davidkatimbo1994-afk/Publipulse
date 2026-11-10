/** Minimal client-side CSV export. Nothing is stored; the file is built in memory and handed to the browser. */

/** Cells starting with these characters can be run as formulas by spreadsheet apps; prefix them with an apostrophe. */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns: readonly string[], rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>): string {
  return [columns, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** Starts a browser download. The BOM keeps accented names intact when opened in Excel. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
