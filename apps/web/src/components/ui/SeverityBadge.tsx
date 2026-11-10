import type { Severity } from '../../data/types';
const CLASS: Record<Severity, string> = { Critical: 'critical', High: 'high', Medium: 'medium', Low: 'low' };
export function SeverityBadge({ level }: { level: Severity }) {
  return <span className={`pp-severity ${CLASS[level]}`}>{level}</span>;
}
