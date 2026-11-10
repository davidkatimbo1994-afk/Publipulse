interface MetricCardProps { title: string; value: string | number; subText: string; onClick?: () => void; }
export function MetricCard({ title, value, subText, onClick }: MetricCardProps) {
  return (
    <button type="button" className="pp-metric-card" onClick={onClick}>
      <p className="label">{title}</p>
      <p className="value">{value}</p>
      <p className="sub">{subText}</p>
    </button>
  );
}
