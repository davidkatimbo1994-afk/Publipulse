import { BarList } from '../components/charts';
import { EmptyState, Notice, SeverityBadge } from '../components/ui';
import { useApp } from '../context/AppContext';
import type { BarRow } from '../data/chartData';
import { gapsNeedingAttention, plural, slaPosition } from '../data/derive';
import { ConnectedWorkspace } from './ConnectedWorkspace';

function countBy(items: readonly { key: string; late: boolean }[]): BarRow[] {
  const totals = new Map<string, number>();
  for (const it of items) if (it.late) totals.set(it.key, (totals.get(it.key) ?? 0) + 1);
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, tone: 'high' as const }));
}

export function IntelligenceView() {
  const { role, gaps } = useApp();
  const attention = gapsNeedingAttention(gaps);
  const byOwner = countBy(gaps.map((g) => ({ key: g.owner, late: g.status === 'Breached' })));
  const byArea = countBy(gaps.map((g) => ({ key: g.area, late: g.status === 'Breached' })));
  const topOwner = byOwner[0];
  const topArea = byArea[0];

  return (
    <div>
      <Notice tone="info" label="How to read this page:">
        Patterns are counted from the Action Gaps list. They are prompts for a team discussion, not a clinical conclusion.
      </Notice>

      <div className="pp-split pp-mt">
        <section className="pp-card" aria-labelledby="owner-title">
          <h3 id="owner-title" className="pp-title-sm">Who is missing response targets most</h3>
          <p className="pp-hint">Number of gaps past their target, by owning team.</p>
          <BarList rows={byOwner} unit="gaps past target" emptyText="No gap is past its target right now." />
        </section>
        <section className="pp-card" aria-labelledby="area-title">
          <h3 id="area-title" className="pp-title-sm">Where it keeps happening</h3>
          <p className="pp-hint">Number of gaps past their target, by area.</p>
          <BarList rows={byArea} unit="gaps past target" emptyText="No area has a gap past its target." />
        </section>
      </div>

      <section className="pp-card pp-mt" aria-labelledby="questions-title">
        <h3 id="questions-title" className="pp-title-sm">Questions for the weekly review</h3>
        {topOwner && topArea ? (
          <ul className="pp-stack-sm pp-plain-list">
            <li className="pp-panel-soft">{topOwner.label} has {plural(topOwner.value, 'gap')} past target. Is the team short of people, transport or supplies?</li>
            <li className="pp-panel-soft">{topArea.label} has {plural(topArea.value, 'gap')} past target. Does the area need a different way of working, or more support?</li>
          </ul>
        ) : (
          <EmptyState title="Nothing stands out" hint="No gaps are past their target, so there is no recurring problem to review." />
        )}
      </section>

      <section className="pp-card pp-mt" aria-labelledby="causes-title">
        <h3 id="causes-title" className="pp-title-sm">Causes reported on open gaps</h3>
        {attention.length === 0 ? (
          <EmptyState title="No open gaps" hint="Causes will appear here when a gap is raised." />
        ) : (
          <div className="pp-table-wrap" tabIndex={0} role="region" aria-label="Gap causes, scrolls sideways on small screens">
            <table className="pp-table">
              <caption className="pp-sr-only">Causes of open action gaps</caption>
              <thead><tr><th scope="col">Gap</th><th scope="col">Severity</th><th scope="col">Owner</th><th scope="col">Time against target</th><th scope="col">Cause</th></tr></thead>
              <tbody>
                {attention.map((g) => (
                  <tr key={g.id}>
                    <td><span className="pp-strong">{g.title}</span><br /><span className="pp-muted pp-text-sm">{g.area}</span></td>
                    <td><SeverityBadge level={g.severity} /></td>
                    <td>{g.owner}</td>
                    <td>{slaPosition(g)}</td>
                    <td>{g.cause}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {role === 'admin' && <ConnectedWorkspace variant="compact" />}
    </div>
  );
}
