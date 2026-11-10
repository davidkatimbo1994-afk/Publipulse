import { useMemo, useState } from 'react';
import { Button, EmptyState, SeverityBadge } from '../components/ui';
import { useApp } from '../context/AppContext';
import { SEVERITY_RANK, plural } from '../data/derive';
import type { HealthSignal } from '../data/types';

const INVESTIGATION_STEPS = [
  { id: 'case-def', label: 'Case definition met' },
  { id: 'sample', label: 'Sample collected and sent' },
  { id: 'contacts', label: 'Contacts listed' },
  { id: 'exposure', label: 'Likely exposure source found' },
  { id: 'report', label: 'Findings reported to district' }
];

type Filter = 'all' | 'open' | 'done';

// Demonstration starting point derived from the signal's own status, so adding a new report never changes another signal's progress.
const STARTING_STEPS: Record<string, number> = { 'Action Pending': 1, 'Under Investigation': 2, 'Response Active': 3, Verified: 4, Closed: 5 };
const initialSteps = (sig: HealthSignal) => INVESTIGATION_STEPS.slice(0, STARTING_STEPS[sig.status] ?? 1).map((st) => st.id);
const teamFor = (sig: HealthSignal) => (Number(sig.id.replace(/\D/g, '')) % 3) + 1;

export function InvestigationsView() {
  const { signals, setNewSignalModalOpen } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  const [ticked, setTicked] = useState<Record<string, string[]>>({});
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const stepsDone = (sig: HealthSignal) => ticked[sig.id] ?? initialSteps(sig);
  const toggleStep = (sig: HealthSignal, step: string) =>
    setTicked((prev) => {
      const cur = prev[sig.id] ?? initialSteps(sig);
      return { ...prev, [sig.id]: cur.includes(step) ? cur.filter((x) => x !== step) : [...cur, step] };
    });

  const isDone = (sig: HealthSignal) => stepsDone(sig).length >= INVESTIGATION_STEPS.length;
  const ordered = useMemo(
    () => [...signals].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]),
    [signals]
  );
  const visible = ordered.filter((sig) => {
    const q = query.trim().toLowerCase();
    const matches = !q || sig.disease.toLowerCase().includes(q) || sig.location.toLowerCase().includes(q) || sig.id.toLowerCase().includes(q);
    const state = isDone(sig) ? 'done' : 'open';
    return matches && (filter === 'all' || filter === state);
  });
  const doneCount = ordered.filter(isDone).length;
  const openCount = ordered.length - doneCount;
  const filtersActive = query.trim() !== '' || filter !== 'all';

  return (
    <div>
      <div className="pp-metric-grid">
        <div className="pp-metric-card pp-passive"><p className="label">Under investigation</p><p className="value">{openCount}</p><p className="sub">Steps still to complete</p></div>
        <div className="pp-metric-card pp-passive"><p className="label">Fully verified</p><p className="value">{doneCount}</p><p className="sub">All 5 steps ticked</p></div>
        <div className="pp-metric-card pp-passive"><p className="label">Total signals</p><p className="value">{ordered.length}</p><p className="sub">Highest severity listed first</p></div>
      </div>

      <div className="pp-card pp-mb">
        <div className="pp-row-wrap-between">
          <div>
            <h3 className="pp-title-sm">Verification and field investigation</h3>
            <p className="pp-hint">Work through each signal&rsquo;s steps. Tick a step when it is done.</p>
          </div>
          <div className="pp-row-wrap">
            <label className="pp-field">
              <span className="pp-sr-only">Search investigations</span>
              <input className="pp-input" type="search" placeholder="Search disease, place or ID" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <label className="pp-field">
              <span className="pp-sr-only">Filter by progress</span>
              <select className="pp-input" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
                <option value="all">All progress</option>
                <option value="open">Still open</option>
                <option value="done">Fully verified</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        filtersActive ? (
          <EmptyState title="No investigations match" hint="Try a different search or progress filter."
            action={<Button variant="secondary" onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</Button>} />
        ) : (
          <EmptyState title="Nothing to investigate yet" hint="Investigations start from a reported signal."
            action={<Button onClick={() => setNewSignalModalOpen(true)}>Report a signal</Button>} />
        )
      ) : (
        <div className="pp-stack">
          {visible.map((sig) => {
            const done = stepsDone(sig);
            const pct = Math.round((done.length / INVESTIGATION_STEPS.length) * 100);
            const isOpen = openId === sig.id;
            return (
              <article key={sig.id} className="pp-card pp-inv-card">
                <div className="pp-row-wrap-between">
                  <div>
                    <strong className="pp-text-sm">{sig.disease}</strong>
                    <span className="pp-mono pp-text-accent pp-inv-id">({sig.id})</span>
                    <p className="pp-hint">Epi Team {teamFor(sig)} · {sig.location} · {plural(sig.cases, 'case')}</p>
                  </div>
                  <SeverityBadge level={sig.severity} />
                </div>
                <div className="pp-row-wrap-between pp-mt-sm">
                  <div className="pp-row">
                    <div className="pp-progress" role="progressbar" aria-label={`Investigation progress for ${sig.id}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                      <div className="pp-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="pp-strong pp-text-sm">{done.length} of {INVESTIGATION_STEPS.length} steps ({pct}%)</span>
                  </div>
                  <Button variant="secondary" aria-expanded={isOpen} aria-controls={`inv-${sig.id}`} onClick={() => setOpenId(isOpen ? null : sig.id)}>
                    {isOpen ? 'Hide steps' : 'Open steps'}
                  </Button>
                </div>
                {isOpen && (
                  <fieldset id={`inv-${sig.id}`} className="pp-panel-soft pp-fieldset-plain">
                    <legend className="pp-strong">Steps for {sig.id}</legend>
                    {INVESTIGATION_STEPS.map((st) => (
                      <label key={st.id} className="pp-check">
                        <input type="checkbox" checked={done.includes(st.id)} onChange={() => toggleStep(sig, st.id)} />
                        {st.label}
                      </label>
                    ))}
                    <p className="pp-hint">Session only: ticks are not saved to the server and reset when the page is refreshed.</p>
                  </fieldset>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
