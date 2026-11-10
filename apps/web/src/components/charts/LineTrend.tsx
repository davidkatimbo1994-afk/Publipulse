import { niceMax } from '../../data/chartData';
import type { WeeklyPoint } from '../../data/trends';

const W = 420, H = 200, L = 36, R = 12, T = 14, B = 30;

/** Weekly trend with a dashed target line. Lower is better for both timeliness measures. */
export function LineTrend({ points, target, unit, label }: { points: WeeklyPoint[]; target: number; unit: string; label: string }) {
  if (points.length < 2) return <p className="pp-hint">At least two weeks of data are needed to draw a trend.</p>;
  const top = niceMax(Math.max(target, ...points.map((p) => p.value)) * 1.1);
  const pw = W - L - R, ph = H - T - B;
  const x = (i: number) => L + (i / (points.length - 1)) * pw;
  const y = (v: number) => T + ph - (v / top) * ph;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const first = points[0], last = points[points.length - 1];
  const ticks = [0, top / 2, top];

  return (
    <figure className="pp-chart-fig">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" className="pp-chart-svg"
        aria-label={`${label}: ${first.value} ${unit} in ${first.label}, ${last.value} ${unit} in ${last.label}. Target ${target} ${unit}.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="pp-chart-grid" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" className="pp-chart-tick">{t}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={y(target)} y2={y(target)} className="pp-chart-target" />
        <text x={W - R} y={y(target) - 5} textAnchor="end" className="pp-chart-tick">target {target} {unit}</text>
        <path d={path} className="pp-chart-line" />
        {points.map((p, i) => (
          <g key={p.label}>
            <circle cx={x(i)} cy={y(p.value)} r={4} className={`pp-chart-dot ${p.value > target ? 'over' : ''}`}><title>{`${p.label}: ${p.value} ${unit}`}</title></circle>
            <text x={x(i)} y={H - 10} textAnchor="middle" className="pp-chart-tick">{p.label}</text>
          </g>
        ))}
        <text x={x(points.length - 1)} y={y(last.value) - 10} textAnchor="end" className="pp-chart-endlabel">{last.value} {unit}</text>
      </svg>
      <figcaption className="pp-chart-legend">
        <span><i className="sw line" /> Weekly average</span>
        <span><i className="sw dash" /> Target</span>
        <span><i className="sw dotover" /> Week over target</span>
      </figcaption>
    </figure>
  );
}
