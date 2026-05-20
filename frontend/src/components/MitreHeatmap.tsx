const cells = [
  { tactic: "Initial Access", score: 0.74 },
  { tactic: "Credential Access", score: 0.83 },
  { tactic: "Persistence", score: 0.66 },
  { tactic: "Privilege Escalation", score: 0.8 },
  { tactic: "Defense Evasion", score: 0.58 },
  { tactic: "Exfiltration", score: 0.52 },
];

function getColor(score: number): string {
  if (score >= 0.8) return "bg-red-500/70";
  if (score >= 0.65) return "bg-orange-500/70";
  if (score >= 0.45) return "bg-yellow-500/70";
  return "bg-emerald-500/70";
}

export function MitreHeatmap() {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <div className="mb-3 text-sm font-medium">MITRE ATT&CK Coverage Heatmap</div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {cells.map((cell) => (
          <div key={cell.tactic} className={`rounded-lg p-3 text-xs ${getColor(cell.score)}`}>
            <div>{cell.tactic}</div>
            <div className="mt-1 font-semibold">{Math.round(cell.score * 100)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}
