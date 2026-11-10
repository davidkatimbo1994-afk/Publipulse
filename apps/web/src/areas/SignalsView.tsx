import { useMemo } from 'react';
import { Button, EmptyState, Notice, SeverityBadge } from '../components/ui';
import { useApp } from '../context/AppContext';
import { plural } from '../data/derive';
import { downloadCsv, toCsv } from '../lib/csv';

export function SignalsView() {
  const { signals, offlineQueue, isOnline, syncQueue, discardQueued, role, searchQuery, filterSeverity, setNewSignalModalOpen, setSelectedSignalForAction, setNewActionModalOpen, lastSubmitNotice, setSearchQuery, setFilterSeverity } = useApp();
  const filtered = useMemo(() => signals.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || s.disease.toLowerCase().includes(q) || s.location.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
    return matchesSearch && (filterSeverity === 'All' || s.severity === filterSeverity);
  }), [signals, searchQuery, filterSeverity]);

  const filtersActive = searchQuery.trim() !== '' || filterSeverity !== 'All';
  const clearFilters = () => { setSearchQuery(''); setFilterSeverity('All'); };

  /** Exports the rows currently shown. Reporter names and free-text notes are left out on purpose. */
  const exportCsv = () => downloadCsv('signals.csv', toCsv(
    ['Signal ID', 'Disease / symptom', 'Location', 'Cases', 'Deaths', 'Severity', 'Status', 'Reported'],
    filtered.map((s) => [s.id, s.disease, s.location, s.cases, s.deaths, s.severity, s.status, s.reportedAt])
  ));

  const openAssign = (sig: (typeof signals)[0]) => { setSelectedSignalForAction(sig); setNewActionModalOpen(true); };

  return (
    <div>
      <div className="pp-card pp-row-wrap-between pp-mb">
        <div>
          <h3 className="pp-title-sm">Health signal stream</h3>
          <p className="pp-hint">Reports from field officers and automated triggers, newest first.</p>
        </div>
        <div className="pp-row-wrap">
          <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>Download CSV</Button>
          <Button onClick={() => setNewSignalModalOpen(true)}>+ Report a signal</Button>
        </div>
      </div>

      {lastSubmitNotice && <div className="pp-mb" aria-live="polite"><Notice tone="info" label="Last report:">{lastSubmitNotice}</Notice></div>}

      {offlineQueue.length > 0 && (
        <section className="pp-card pp-mb" aria-label="Signals waiting to sync">
          <Notice tone="warning" label={`${offlineQueue.length} signal${offlineQueue.length === 1 ? '' : 's'} waiting to sync`}>
            Saved on this device only, not on the server yet.
          </Notice>
          {isOnline && (
            <div className="pp-mt-sm">
              <Button variant="secondary" onClick={() => void syncQueue()}>Retry sync now</Button>
            </div>
          )}
          <ul className="pp-queue-list">
            {offlineQueue.map((item) => (
              <li key={item.id} className="pp-panel-row">
                <span><strong>{item.disease}</strong> · {item.location} · {item.cases} cases</span>
                <span className="pp-row-sm">
                  <span className="pp-strong pp-text-warning">Pending sync</span>
                  <Button variant="ghost" aria-label={`Remove queued report: ${item.disease}, ${item.location}`}
                    onClick={() => { if (window.confirm('Remove this report from this session? It has not reached the server and cannot be recovered.')) discardQueued(item.id); }}>
                    Remove
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {filtered.length === 0 ? (
        filtersActive ? (
          <EmptyState title="No signals match your filters" hint="Try a different search or severity."
            action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>} />
        ) : (
          <EmptyState title="No signals yet" hint="When a field officer reports a signal, it will appear here."
            action={<Button onClick={() => setNewSignalModalOpen(true)}>Report the first signal</Button>} />
        )
      ) : role === 'officer' ? (
        <div className="pp-signal-card-grid">
          {filtered.map((sig) => (
            <article key={sig.id} className="pp-signal-card">
              <div className="pp-row-between">
                <div>
                  <span className="pp-mono pp-text-accent pp-strong">{sig.id}</span>
                  <h4 className="pp-card-title">{sig.disease}</h4>
                </div>
                <SeverityBadge level={sig.severity} />
              </div>
              <div className="pp-panel-soft">
                <div>{sig.location}</div>
                <div className="pp-mt-sm">{plural(sig.cases, 'suspected case')} ({plural(sig.deaths, 'death')})</div>
                <div className="pp-mt-sm pp-muted"><strong>Notes:</strong> {sig.notes}</div>
              </div>
              <div className="pp-row-between pp-text-sm">
                <span className="pp-muted">{sig.reportedAt}</span>
                <span className="pp-chip-tag">{sig.status}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="pp-table-wrap" tabIndex={0} role="region" aria-label="Signals table, scrolls sideways on small screens">
          <table className="pp-table">
            <caption className="pp-sr-only">Health signals</caption>
            <thead>
              <tr>
                <th scope="col">Signal ID</th><th scope="col">Disease / symptom</th><th scope="col">Location</th>
                <th scope="col">Cases / deaths</th><th scope="col">Severity</th><th scope="col">Reporter</th>
                <th scope="col">Reported</th><th scope="col">Status</th><th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sig) => (
                <tr key={sig.id}>
                  <td className="pp-mono pp-text-accent pp-strong">{sig.id}</td>
                  <td className="pp-strong">{sig.disease}</td>
                  <td>{sig.location}</td>
                  <td>{sig.cases} / <span className="pp-text-danger">{sig.deaths}</span></td>
                  <td><SeverityBadge level={sig.severity} /></td>
                  <td className="pp-muted">{sig.reporter}</td>
                  <td className="pp-muted">{sig.reportedAt}</td>
                  <td><span className="pp-chip-tag">{sig.status}</span></td>
                  <td><Button variant="secondary" onClick={() => openAssign(sig)}>Assign response</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
