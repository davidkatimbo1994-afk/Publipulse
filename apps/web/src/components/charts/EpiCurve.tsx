import { axisTicks, niceMax } from '../../data/chartData';
import type { DailyCount } from '../../data/trends';

const W = 640, H = 260, L = 38, R = 10, T = 14, B = 34;

/** Epidemic curve: one bar per day of new suspected cases; a ring marks days with deaths. */
export function EpiCurve({ days, label }: { days: DailyCount[]; label: string }) {
  const top = niceMax(Math.max(1, ...days.map((d) => d.cases)));
  const pw = W - L - R, ph = H - T - B;
  const slot = pw / days.length, bw = Math.max(6, slot * 0.68);
  const y = (v: number) => T + ph - (v / top) * ph;
  const ticks = axisTicks(top);
  const total = days.reduce((n, d) => n + d.cases, 0);
  const deaths = days.reduce((n, d) => n + d.deaths, 0);

  return (
    <figure className="pp-chart-fig">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" className="pp-chart-svg"
        aria-label={`Epidemic curve, ${label}: ${total} suspected cases and ${deaths} deaths over ${days.length} days, from ${days[0]?.date} to ${days[days.length - 1]?.date}.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="pp-chart-grid" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" className="pp-chart-tick">{t}</text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = L + i * slot + (slot - bw) / 2;
          const h = (d.cases / top) * ph;
          return (
            <g key={d.date}>
              <rect x={x} y={y(d.cases)} width={bw} height={h} rx={2} className="pp-chart-bar">
                <title>{`${d.date}: ${d.cases} cases, ${d.deaths} deaths`}</title>
              </rect>
              {d.deaths > 0 && <circle cx={x + bw / 2} cy={Math.max(T + 6, y(d.cases) - 9)} r={5} className="pp-chart-death" />}
              {(i % 2 === days.length % 2 || i === days.length - 1) && (
                <text x={x + bw / 2} y={H - 12} textAnchor="middle" className="pp-chart-tick">{d.date.slice(5)}</text>
              )}
            </g>
          );
        })}
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} className="pp-chart-axis" />
      </svg>
      <figcaption className="pp-chart-legend">
        <span><i className="sw bar" /> New suspected cases per day</span>
        <span><i className="sw ring" /> Day with a death</span>
      </figcaption>
    </figure>
  );
}
