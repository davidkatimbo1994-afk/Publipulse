import { useState } from 'react';
import { BarList, ChartCard, EpiCurve, SlaBars } from '../components/charts';
import { Button, EmptyState, MetricCard, SeverityBadge } from '../components/ui';
import { useApp } from '../context/AppContext';
import { openSignalsBySeverity, slaRows } from '../data/chartData';
import { gapsNeedingAttention, openSignalsByPriority, plural, slaPosition } from '../data/derive';
import { DEMO_OUTBREAK_SERIES } from '../data/trends';

export function DashboardView() {
  const {
    signals, offlineQueue, gaps, actions, role, setActiveTab,
    setSelectedSignalForAction, setNewActionModalOpen, setNewSignalModalOpen
  } = useApp();

  const [seriesId, setSeriesId] = useState(DEMO_OUTBREAK_SERIES[0].id);
  const series = DEMO_OUTBREAK_SERIES.find((x) => x.id === seriesId) ?? DEMO_OUTBREAK_SERIES[0];
  const severityRows = openSignalsBySeverity(signals);
  const timing = slaRows(gaps);

  const open = openSignalsByPriority([...signals]);
  const urgent = open.filter((s) => s.severity === 'Critical' || s.severity === 'High').length;
  const attention = gapsNeedingAttention([...gaps]);
  const breached = gaps.filter((g) => g.status === 'Breached').length;
  const done = actions.filter((a) => a.status === 'Completed').length;
  const critical = open.find((s) => s.severity === 'Critical');

  const openAssign = (signalId: string) => {
    const sig = signals.find((s) => s.id === signalId);
    if (!sig) return;
    setSelectedSignalForAction(sig);
    setNewActionModalOpen(true);
  };

  return (
    <div>
      {role === 'officer' && (
        <section className="pp-card pp-row-wrap-between pp-mb" aria-label="Quick report">
          <div>
            <h3 className="pp-title-sm">See something unusual?</h3>
            <p className="pp-hint">
              Report it in about a minute. It works offline
              {offlineQueue.length > 0 ? ` — ${offlineQueue.length} report${offlineQueue.length === 1 ? '' : 's'} waiting to sync.` : '.'}
            </p>
          </div>
          <Button onClick={() => setNewSignalModalOpen(true)}>+ Report a signal</Button>
        </section>
      )}

      <div className="pp-metric-grid">
        <MetricCard title="Open health signals" value={open.length} subText={`${urgent} urgent or high`} onClick={() => setActiveTab('signals')} />
        <MetricCard title="Action gaps" value={attention.length} subText={`${breached} past their time target`} onClick={() => setActiveTab('gaps')} />
        <MetricCard title="Open actions" value={actions.length - done} subText={`${done} of ${actions.length} completed`} onClick={() => setActiveTab('actions')} />
        <MetricCard title="Signals closed" value={signals.length - open.length} subText={`of ${signals.length} reported`} onClick={() => setActiveTab('outcomes')} />
      </div>

      <div className="pp-charts two">
        <div className="wide">
          <ChartCard id="epi" title="Epidemic curve" subtitle="New suspected cases per day, last 14 days." demo csvName={`epi-curve-${series.id}.csv`}
            table={{ columns: ['Date', 'Cases', 'Deaths'], rows: series.days.map((d) => [d.date, d.cases, d.deaths]) }}
            toolbar={
              <select className="pp-chart-select" aria-label="Choose outbreak to chart" value={seriesId} onChange={(e) => setSeriesId(e.target.value)}>
                {DEMO_OUTBREAK_SERIES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            }>
            <EpiCurve days={series.days} label={series.label} />
          </ChartCard>
        </div>
        <ChartCard id="sev" title="Open signals by severity" subtitle="Signals still being worked, from the list below." csvName="open-signals-by-severity.csv"
          table={{ columns: ['Severity', 'Open signals'], rows: severityRows.map((r) => [r.label, r.value]) }}>
          <BarList rows={severityRows} unit="open signals by severity" emptyText="No open signals." />
        </ChartCard>
        <ChartCard id="sla" title="Response time against target" subtitle="The dark tick on each bar is the time target." csvName="response-time-vs-target.csv"
          table={{ columns: ['Gap', 'Area', 'Hours used', 'Target hours', 'Status'], rows: timing.map((r) => [r.label, r.area, r.elapsed, r.target, r.status]) }}>
          <SlaBars rows={timing} />
        </ChartCard>
      </div>

      {critical && (
        <div className="pp-alert-banner" role="status">
          <div>
            <h3>Critical signal: {critical.disease} <SeverityBadge level={critical.severity} /></h3>
            <p>{critical.location} · {plural(critical.cases, 'suspected case')}, {plural(critical.deaths, 'death')} · {critical.status}</p>
          </div>
          <Button onClick={() => setActiveTab('signals')}>Review signals</Button>
        </div>
      )}

      <div className="pp-split">
        <section className="pp-card" aria-labelledby="dash-priority">
          <div className="pp-row-between pp-mb">
            <h3 className="pp-title-sm" id="dash-priority">Priority signals</h3>
            <Button variant="ghost" onClick={() => setActiveTab('signals')}>View all →</Button>
          </div>
          {open.length === 0 ? (
            <EmptyState title="No open signals" hint="New reports will appear here, most urgent first." />
          ) : (
            <ul className="pp-list">
              {open.slice(0, 4).map((sig) => (
                <li key={sig.id} className="pp-list-item">
                  <div>
                    <div className="pp-row-wrap">
                      <strong className="pp-text-sm">{sig.disease}</strong>
                      <SeverityBadge level={sig.severity} />
                    </div>
                    <p className="pp-hint">{sig.location} · {plural(sig.cases, 'suspected case')} · <span className="pp-mono">{sig.id}</span></p>
                  </div>
                  <div className="pp-row-sm">
                    <span className="pp-chip-tag">{sig.status}</span>
                    {role === 'admin' && <Button variant="secondary" onClick={() => openAssign(sig.id)}>Assign response</Button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pp-card" aria-labelledby="dash-gaps">
          <div className="pp-row-between pp-mb">
            <h3 className="pp-title-sm" id="dash-gaps">Responses running late</h3>
            <Button variant="ghost" onClick={() => setActiveTab('gaps')}>Details</Button>
          </div>
          {attention.length === 0 ? (
            <EmptyState title="Nothing is running late" hint="Responses that miss their time target will show here." />
          ) : (
            <ul className="pp-list">
              {attention.map((gap) => (
                <li key={gap.id} className={`pp-list-item pp-gap ${gap.status === 'Breached' ? 'breached' : 'warning'}`}>
                  <div>
                    <strong className="pp-text-sm">{gap.title}</strong>
                    <p className="pp-hint">{gap.area} · {gap.owner}</p>
                  </div>
                  <span className={`pp-severity ${gap.status === 'Breached' ? 'critical' : 'medium'}`}>
                    {gap.status === 'Breached' ? 'Late' : 'At risk'}: {slaPosition(gap)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
