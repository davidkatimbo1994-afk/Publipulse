import type { BarRow } from '../../data/chartData';

/** Horizontal bars with the number printed beside each, so colour is never the only signal. */
export function BarList({ rows, unit, emptyText = 'Nothing to show yet.' }: { rows: BarRow[]; unit: string; emptyText?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0 || rows.every((r) => r.value === 0)) return <p className="pp-hint">{emptyText}</p>;
  return (
    <ul className="pp-barlist" aria-label={`Bar chart, ${unit}`}>
      {rows.map((r) => (
        <li key={r.label}>
          <span className="pp-barlist-label">{r.label}</span>
          <span className="pp-barlist-track" aria-hidden="true">
            <span className={`pp-barlist-fill tone-${r.tone}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <strong className="pp-barlist-val">{r.value}</strong>
        </li>
      ))}
    </ul>
  );
}
