import type { ReactNode } from 'react';

export type NoticeTone = 'info' | 'warning' | 'danger' | 'success';

interface NoticeProps {
  tone?: NoticeTone;
  /** Short text label so meaning never depends on colour alone. */
  label: string;
  children?: ReactNode;
}

export function Notice({ tone = 'info', label, children }: NoticeProps) {
  return (
    <div className={`pp-notice ${tone}`} role="status">
      <strong>{label}</strong>
      {children && <span>{children}</span>}
    </div>
  );
}
