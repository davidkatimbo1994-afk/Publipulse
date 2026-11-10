import { Button, EmptyState, Notice } from '../components/ui';
import { useApp } from '../context/AppContext';
import { gapsNeedingAttention, hoursText, slaPosition } from '../data/derive';

export function ActionGapsView() {
  const { gaps, escalateGap } = useApp();
  const list = gapsNeedingAttention([...gaps]);
  const onTrack = gaps.length - list.length;

  return (
    <div>
      <div className="pp-card pp-mb">
        <h3 className="pp-title-sm">Delayed, blocked or unresolved responses</h3>
        <p className="pp-hint">
          Each item shows the time target, how long it has taken, who owns it and the likely cause.
          {onTrack > 0 ? ` ${onTrack} other response${onTrack === 1 ? ' is' : 's are'} on track.` : ''}
        </p>
      </div>

      {list.length === 0 ? (
        <EmptyState title="No action gaps" hint="Every response is within its time target." />
      ) : (
        <div className="pp-card-grid">
          {list.map((gap) => (
            <article key={gap.id} className="pp-card">
              <div className="pp-row-between">
                <span className="pp-mono pp-strong pp-text-danger">{gap.id}</span>
                <span className={`pp-severity ${gap.status === 'Breached' ? 'critical' : 'medium'}`}>
                  {gap.status === 'Breached' ? 'Past target' : 'At risk'}
                </span>
              </div>
              <h4 className="pp-card-title">{gap.title}</h4>
              <p className="pp-hint">{gap.area}</p>
              <dl className="pp-review pp-mt-sm">
                <div><dt>Time target</dt><dd>{hoursText(gap.slaHours)}</dd></div>
                <div><dt>Elapsed</dt><dd className={gap.status === 'Breached' ? 'pp-text-danger' : ''}>{hoursText(gap.elapsedHours)}</dd></div>
                <div><dt>Position</dt><dd>{slaPosition(gap)}</dd></div>
                <div><dt>Owner</dt><dd>{gap.owner}</dd></div>
              </dl>
              <p className="pp-hint"><strong>Likely cause:</strong> {gap.cause}</p>
              {gap.escalated ? (
                <div className="pp-mt-sm"><Notice tone="success" label="Escalated">Sent to the district taskforce (this session).</Notice></div>
              ) : (
                <Button variant="secondary" block className="pp-mt-sm" onClick={() => escalateGap(gap.id)}>
                  Escalate to district taskforce
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
