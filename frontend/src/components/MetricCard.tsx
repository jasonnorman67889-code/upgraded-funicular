type Props = {
  title: string;
  value: string | number;
  hint?: string;
};

export function MetricCard({ title, value, hint }: Props) {
  return (
    <div className="rounded-xl border border-cyan-200/20 bg-panel/70 p-4 backdrop-blur">
      <div className="text-xs uppercase tracking-wide text-cyan-200/80">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-300">{hint}</div> : null}
    </div>
  );
}
