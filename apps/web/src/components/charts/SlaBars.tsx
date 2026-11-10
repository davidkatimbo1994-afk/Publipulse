import type { SlaRow } from '../../data/chartData';
import { hoursText } from '../../data/derive';

/** Time used against the time target. The tick on each track is the target; a fill past it means the response is late. */
export function SlaBars({ rows }: { rows: SlaRow[] }) {
  if (rows.length === 0) return <p className="pp-hint">No responses are being timed yet.</p>;
  const scale = Math.max(1, ...rows.map((r) => Math.max(r.target, r.elapsed))) * 1.05;
  return (
    <ul className="pp-sla" aria-label="Time used against each response time target">
      {rows.map((r) => {
        const late = r.elapsed > r.target;
        return (
          <li key={r.id}>
            <div className="pp-sla-top">
              <span className="pp-sla-title">{r.label}</span>
              <span className={`pp-sla-state ${late ? 'late' : r.status === 'Warning' ? 'risk' : 'ok'}`}>
                {late ? 'Late' : r.status === 'Warning' ? 'At risk' : 'On track'}
              </span>
            </div>
            <div className="pp-sla-track" aria-hidden="true">
              <span className={`pp-sla-fill ${late ? 'late' : r.status === 'Warning' ? 'risk' : 'ok'}`} style={{ width: `${(r.elapsed / scale) * 100}%` }} />
              <span className="pp-sla-target" style={{ left: `${(r.target / scale) * 100}%` }} />
            </div>
            <p className="pp-hint">{hoursText(r.elapsed)} used of {hoursText(r.target)} target · {r.area}</p>
          </li>
        );
      })}
    </ul>
  );
}
