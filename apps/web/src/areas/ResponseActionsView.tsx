import { Button, EmptyState } from '../components/ui';
import { useApp } from '../context/AppContext';
import { isActionOverdue, todayIso } from '../data/derive';
import type { ResponseAction } from '../data/types';

const GROUPS: { status: ResponseAction['status']; title: string }[] = [
  { status: 'Pending', title: 'Not started' },
  { status: 'In Progress', title: 'In progress' },
  { status: 'Completed', title: 'Completed' }
];
const PRIORITY_CLASS = { Critical: 'critical', High: 'high', Medium: 'medium' } as const;

export function ResponseActionsView() {
  const { actions, toggleActionStatus, setNewActionModalOpen } = useApp();
  const today = todayIso();

  return (
    <div>
      <div className="pp-card pp-row-wrap-between pp-mb">
        <div>
          <h3 className="pp-title-sm">Who is doing what</h3>
          <p className="pp-hint">Every action has an owner, a priority and a due date.</p>
        </div>
        <Button onClick={() => setNewActionModalOpen(true)}>+ Assign an action</Button>
      </div>

      {actions.length === 0 ? (
        <EmptyState title="No response actions yet" hint="Assign an action to a signal to start tracking the response."
          action={<Button onClick={() => setNewActionModalOpen(true)}>Assign the first action</Button>} />
      ) : (
        GROUPS.map(({ status, title }) => {
          const items = actions.filter((a) => a.status === status);
          if (items.length === 0) return null;
          return (
            <section key={status} className="pp-mb" aria-label={`${title}, ${items.length}`}>
              <h3 className="pp-group-title">{title} <span className="pp-muted">({items.length})</span></h3>
              <ul className="pp-list">
                {items.map((act) => {
                  const overdue = isActionOverdue(act, today);
                  const completed = act.status === 'Completed';
                  return (
                    <li key={act.id} className="pp-list-item">
                      <div>
                        <strong className={`pp-text-sm ${completed ? 'pp-done' : ''}`}>{act.title}</strong>
                        <p className="pp-hint">
                          {act.assignee} · Signal <span className="pp-mono">{act.signalId}</span> · Due {act.dueDate}
                          {overdue && <strong className="pp-text-danger"> · Overdue</strong>}
                        </p>
                      </div>
                      <div className="pp-row-sm">
                        <span className={`pp-severity ${PRIORITY_CLASS[act.priority]}`}>{act.priority}</span>
                        <Button variant="secondary" onClick={() => toggleActionStatus(act.id)}
                          aria-label={`${completed ? 'Reopen' : 'Mark complete'}: ${act.title}`}>
                          {completed ? 'Reopen' : 'Mark complete'}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
