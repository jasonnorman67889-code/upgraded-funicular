type Edge = {
  source: string;
  target: string;
  relation: string;
  deltaSeconds: number;
};

export function EntityGraph({ edges }: { edges: Edge[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <div className="mb-2 text-sm font-medium">Entity Investigation Graph</div>
      <div className="max-h-48 overflow-auto space-y-2 text-xs">
        {edges.length === 0 ? <div className="text-slate-400">No graph edges yet.</div> : null}
        {edges.map((edge, idx) => (
          <div key={`${edge.source}-${idx}`} className="rounded border border-white/10 p-2">
            <div>{edge.source} {"->"} {edge.target}</div>
            <div className="text-slate-400">{edge.relation} ({edge.deltaSeconds}s)</div>
          </div>
        ))}
      </div>
    </div>
  );
}
