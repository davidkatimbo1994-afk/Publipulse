import { useState } from 'react';
import type { FormEvent } from 'react';
import { ChartCard, LineTrend } from '../components/charts';
import { Button, EmptyState, Notice } from '../components/ui';
import { useApp } from '../context/AppContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { downloadCsv, toCsv } from '../lib/csv';
import { DEMO_DETECT_HOURS, DEMO_DETECT_TARGET_HOURS, DEMO_RESPOND_HOURS, DEMO_RESPOND_TARGET_HOURS } from '../data/trends';
import { ConnectedWorkspace } from './ConnectedWorkspace';

const DEMO_METRICS = [
  { label: 'Mean time to detect', value: '4.2 h', sub: '1.5 h faster than last month' },
  { label: 'Mean time to respond', value: '11.8 h', sub: 'Within the response target' },
  { label: 'Containment rate', value: '92.4%', sub: 'Target: 90% or more' }
];

export function OutcomesView() {
  const { role, actions, signals } = useApp();
  const { evidence, addEvidence } = useWorkspace();
  const [record, setRecord] = useState('');
  const [what, setWhat] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const completed = actions.filter((a) => a.status === 'Completed').length;
  const completedPct = actions.length === 0 ? 0 : Math.round((completed / actions.length) * 100);
  const records = [...signals.map((s) => s.id), ...actions.map((a) => a.id)];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!record) { setError('Choose the signal or action this evidence belongs to.'); return; }
    if (what.trim().length < 5) { setError('Describe the evidence in at least a few words.'); return; }
    addEvidence(record, what.trim());
    setError('');
    setSaved(`Evidence added for ${record}. It stays in this browser session only.`);
    setRecord('');
    setWhat('');
  };

  const exportReport = () => downloadCsv('outcomes-report.csv', toCsv(
    ['Section', 'Item', 'Value'],
    [
      ['Note', 'Demonstration data', 'Headline metrics and weekly trends are not read from the API'],
      ...DEMO_METRICS.map((m) => ['Metric', m.label, `${m.value} (${m.sub})`]),
      ['Metric', 'Response actions completed (this session)', `${completed} of ${actions.length}`],
      ...evidence.map((ev) => ['Evidence', `${ev.record} ${ev.what}`, ev.hash ? `Hash: ${ev.hash}` : 'Not hashed (session only)'])
    ]
  ));

  return (
    <div>
      <section aria-label="Headline results">
        <div className="pp-row-wrap-between pp-mb">
          <h3 className="pp-title-sm">Headline results</h3>
          <span className="pp-chip-tag">First three: demonstration data</span>
        </div>
        <div className="pp-metric-grid">
          {DEMO_METRICS.map((m) => (
            <div key={m.label} className="pp-metric-card pp-passive"><p className="label">{m.label}</p><p className="value">{m.value}</p><p className="sub">{m.sub}</p></div>
          ))}
          <div className="pp-metric-card pp-passive">
            <p className="label">Actions completed</p><p className="value">{completedPct}%</p>
            <p className="sub">{completed} of {actions.length} in this session</p>
          </div>
        </div>
      </section>

      <div className="pp-charts two">
        <ChartCard id="detect" title="Time to detect, by week" subtitle="Average hours from first case to detection. Lower is better." demo csvName="time-to-detect-weekly.csv"
          table={{ columns: ['Week', 'Hours', 'Target hours'], rows: DEMO_DETECT_HOURS.map((p) => [p.label, p.value, DEMO_DETECT_TARGET_HOURS]) }}>
          <LineTrend points={DEMO_DETECT_HOURS} target={DEMO_DETECT_TARGET_HOURS} unit="h" label="Time to detect" />
        </ChartCard>
        <ChartCard id="respond" title="Time to respond, by week" subtitle="Average hours from detection to first response. Lower is better." demo csvName="time-to-respond-weekly.csv"
          table={{ columns: ['Week', 'Hours', 'Target hours'], rows: DEMO_RESPOND_HOURS.map((p) => [p.label, p.value, DEMO_RESPOND_TARGET_HOURS]) }}>
          <LineTrend points={DEMO_RESPOND_HOURS} target={DEMO_RESPOND_TARGET_HOURS} unit="h" label="Time to respond" />
        </ChartCard>
      </div>

      <section className="pp-card pp-mb" aria-labelledby="record-evidence-title">
        <h3 id="record-evidence-title" className="pp-title-sm">Record evidence</h3>
        <p className="pp-hint">Attach proof to a signal or action, such as a lab result or a delivery receipt.</p>
        <form className="pp-stack-sm pp-mt-sm" onSubmit={submit} noValidate>
          <label className="pp-field">
            Belongs to
            <select className="pp-input" value={record} onChange={(e) => setRecord(e.target.value)}>
              <option value="">Choose a signal or action</option>
              {records.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </label>
          <label className="pp-field">
            What does it show?
            <textarea className="pp-input" rows={3} value={what} onChange={(e) => setWhat(e.target.value)} placeholder="Example: lab confirmed positive for 6 of 8 samples" />
          </label>
          {error && <Notice tone="danger" label="Check this:">{error}</Notice>}
          {saved && !error && <Notice tone="success" label="Added:">{saved}</Notice>}
          <div><Button type="submit">Add evidence</Button></div>
        </form>
      </section>

      <section className="pp-card pp-mb" aria-labelledby="evidence-log-title">
        <div className="pp-row-wrap-between pp-mb">
          <div>
            <h3 id="evidence-log-title" className="pp-title-sm">Evidence log</h3>
            <p className="pp-hint">Items added here have no content hash until the server stores them.</p>
          </div>
          <Button variant="secondary" onClick={exportReport}>Export report (CSV)</Button>
        </div>
        {evidence.length === 0 ? (
          <EmptyState title="No evidence recorded yet" hint="Use the form above to add the first item." />
        ) : (
          <div className="pp-table-wrap" tabIndex={0} role="region" aria-label="Evidence log, scrolls sideways on small screens">
            <table className="pp-table">
              <caption className="pp-sr-only">Evidence provenance log</caption>
              <thead><tr><th scope="col">Record</th><th scope="col">Evidence</th><th scope="col">Hash</th></tr></thead>
              <tbody>
                {evidence.map((ev) => (
                  <tr key={ev.id}>
                    <td className="pp-mono pp-text-accent pp-strong">{ev.record}</td>
                    <td>{ev.what}</td>
                    <td className="pp-mono pp-muted">{ev.hash ?? 'Not hashed (session only)'}</td>
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
