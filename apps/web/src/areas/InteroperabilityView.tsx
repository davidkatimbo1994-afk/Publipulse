import { useState } from 'react';
import { Button, EmptyState, Notice } from '../components/ui';
import { useApp } from '../context/AppContext';
import type { InteropSystem } from '../data/types';
import { plural } from '../data/derive';
import { ConnectedWorkspace } from './ConnectedWorkspace';

type Filter = 'all' | 'attention';
const needsAttention = (s: InteropSystem) => s.status === 'Degraded' || s.status === 'Offline' || s.errorCount > 0;

export function InteroperabilityView() {
  const { systems, toggleSystemStatus, role } = useApp();
  const [filter, setFilter] = useState<Filter>('all');

  const connected = systems.filter((s) => s.status === 'Connected' || s.status === 'Syncing').length;
  const attention = systems.filter(needsAttention).length;
  const errors = systems.reduce((sum, s) => sum + s.errorCount, 0);
  const visible = filter === 'all' ? systems : systems.filter(needsAttention);

  return (
    <div>
      <Notice tone="warning" label="Sending is switched off:">
        Live transport to these systems stays disabled until a verified adapter is enabled. The list below is for planning and monitoring.
      </Notice>

      <div className="pp-metric-grid pp-mt">
        <div className="pp-metric-card pp-passive"><p className="label">Connections</p><p className="value">{systems.length}</p><p className="sub">DHIS2, FHIR, EWARS and lab systems</p></div>
        <div className="pp-metric-card pp-passive"><p className="label">Working</p><p className="value">{connected}</p><p className="sub">Connected or syncing</p></div>
        <div className="pp-metric-card pp-passive"><p className="label">Need attention</p><p className="value">{attention}</p><p className="sub">Degraded, offline or with errors</p></div>
        <div className="pp-metric-card pp-passive"><p className="label">Errors</p><p className="value">{errors}</p><p className="sub">Across all connections</p></div>
      </div>

      <div className="pp-row-wrap pp-mb" role="group" aria-label="Filter connections">
        <Button variant={filter === 'all' ? 'primary' : 'secondary'} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All connections</Button>
        <Button variant={filter === 'attention' ? 'primary' : 'secondary'} aria-pressed={filter === 'attention'} onClick={() => setFilter('attention')}>Need attention</Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="Every connection is healthy" hint="Nothing needs attention right now."
          action={<Button variant="secondary" onClick={() => setFilter('all')}>Show all connections</Button>} />
      ) : (
        <div className="pp-card-grid">
          {visible.map((sys) => (
            <article key={sys.id} className="pp-card">
              <div className="pp-row-between">
                <div>
                  <strong className="pp-text-sm">{sys.name}</strong>
                  <p className="pp-mono pp-muted pp-text-sm">{sys.type}</p>
                </div>
                <span className={`pp-conn-status ${sys.status.toLowerCase()}`}>{sys.status}</span>
              </div>
              <dl className="pp-kv pp-mt-sm">
                <div><dt>Last sync</dt><dd>{sys.lastSync}</dd></div>
                <div><dt>Records</dt><dd>{sys.recordsSynced.toLocaleString()}</dd></div>
                <div><dt>Errors</dt><dd>{plural(sys.errorCount, 'error')}</dd></div>
              </dl>
              {role === 'admin' ? (
                <div className="pp-mt-sm">
                  <Button variant="secondary" onClick={() => toggleSystemStatus(sys.id)}>
                    {sys.status === 'Offline' ? 'Resume connection' : 'Pause connection'}
                  </Button>
                  <p className="pp-hint">Changes this display only, for this session.</p>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {role === 'admin' && <ConnectedWorkspace variant="full" />}
    </div>
  );
}
