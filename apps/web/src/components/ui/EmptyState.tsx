import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  /** One short sentence telling the user what to do next. */
  hint?: string;
  action?: ReactNode;
}

export function EmptyState({ title, hint, action }: EmptyStateProps) {
  return (
    <div className="pp-empty" role="status">
      <strong className="pp-empty-title">{title}</strong>
      {hint && <p className="pp-hint">{hint}</p>}
      {action && <div className="pp-empty-action">{action}</div>}
    </div>
  );
}
