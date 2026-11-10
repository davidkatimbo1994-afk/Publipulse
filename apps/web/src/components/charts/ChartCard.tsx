import type { ReactNode } from 'react';
import { downloadCsv, toCsv } from '../../lib/csv';

interface ChartCardProps {
  id: string; title: string; subtitle?: string;
  /** True when the numbers are fixtures, not live data. Shown as a visible badge. */
  demo?: boolean;
  children: ReactNode;
  /** The same numbers as the chart, as a table. Lets screen-reader and print users read exact values, and powers CSV export. */
  table: { columns: string[]; rows: Array<Array<string | number>> };
  csvName: string;
  toolbar?: ReactNode;
}

export function ChartCard({ id, title, subtitle, demo, children, table, csvName, toolbar }: ChartCardProps) {
  return (
    <section className="pp-card pp-chart-card" aria-labelledby={`${id}-t`}>
      <div className="pp-chart-head">
        <div>
          <h3 className="pp-title-sm" id={`${id}-t`}>{title}</h3>
          {subtitle && <p className="pp-hint">{subtitle}</p>}
        </div>
        {demo && <span className="pp-chart-demo">Demonstration data</span>}
      </div>
      {toolbar}
      <div className="pp-chart-body">{children}</div>
      <div className="pp-chart-foot">
        <details className="pp-chart-details">
          <summary>View as table</summary>
          <div className="pp-table-wrap" tabIndex={0} role="region" aria-label={`${title}, data table`}>
            <table className="pp-table">
              <caption className="pp-sr-only">{title}</caption>
              <thead><tr>{table.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
              <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </details>
        <button type="button" className="pp-btn-ghost" onClick={() => downloadCsv(csvName, toCsv(table.columns, table.rows))}>
          Download CSV
        </button>
      </div>
    </section>
  );
}
