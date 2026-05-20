type StreamEvent = {
  eventId: string;
  entityId: string;
  eventType: string;
  riskScore: number;
  timeGenerated: string;
};

type GraphEdge = {
  source: string;
  target: string;
  entityId: string;
  relation: string;
  deltaSeconds: number;
};

const mitreByEvent: Record<string, string> = {
  PasswordSpray: "T1110.003",
  MfaFatigue: "T1621",
  ImpossibleTravel: "T1078",
  TokenReplay: "T1528",
  OAuthPersistence: "T1098",
  SessionHijack: "T1539",
  PrivilegeEscalation: "T1078.004",
};

export function EntityInvestigationWorkspace({
  selectedEntity,
  events,
  edges,
  onEntityChange,
}: {
  selectedEntity: string;
  events: StreamEvent[];
  edges: GraphEdge[];
  onEntityChange: (entity: string) => void;
}) {
  const entities = Array.from(new Set(events.map((event) => event.entityId))).sort();
  const scopedEvents = events.filter((event) => event.entityId === selectedEntity);
  const scopedEdges = edges.filter((edge) => edge.entityId === selectedEntity);
  const techniques = Array.from(
    new Set(
      scopedEvents
        .map((event) => mitreByEvent[event.eventType])
        .filter((item): item is string => Boolean(item))
    )
  );

  return (
    <div className="rounded-xl border border-white/10 bg-panel/60 p-4 backdrop-blur">
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h2 className="text-lg font-semibold">Entity Investigation Workspace</h2>
        <select
          className="rounded border border-cyan-300/30 bg-slate-900/70 px-2 py-1 text-sm"
          value={selectedEntity}
          onChange={(event) => onEntityChange(event.target.value)}
        >
          {entities.map((entity) => (
            <option key={entity} value={entity}>
              {entity}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded border border-white/10 bg-slate-950/40 p-3">
          <div className="mb-2 text-sm font-medium">Recent Entity Events</div>
          <div className="max-h-56 space-y-2 overflow-auto text-xs">
            {scopedEvents.length === 0 ? <div className="text-slate-400">No events for selected entity.</div> : null}
            {scopedEvents.map((event) => (
              <div key={event.eventId} className="rounded border border-white/10 p-2">
                <div className="font-semibold">{event.eventType}</div>
                <div>Risk {event.riskScore.toFixed(2)}</div>
                <div className="text-slate-400">{new Date(event.timeGenerated).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-white/10 bg-slate-950/40 p-3">
          <div className="mb-2 text-sm font-medium">Graph Edges + MITRE Drilldown</div>
          <div className="mb-2 flex flex-wrap gap-2 text-xs">
            {techniques.length === 0 ? <span className="text-slate-400">No mapped techniques</span> : null}
            {techniques.map((technique) => (
              <span key={technique} className="rounded-full border border-orange-300/40 px-2 py-0.5">
                {technique}
              </span>
            ))}
          </div>
          <div className="max-h-48 space-y-2 overflow-auto text-xs">
            {scopedEdges.length === 0 ? <div className="text-slate-400">No edges for selected entity.</div> : null}
            {scopedEdges.map((edge, idx) => (
              <div key={`${edge.source}-${idx}`} className="rounded border border-white/10 p-2">
                <div>{edge.source} {"->"} {edge.target}</div>
                <div className="text-slate-400">{edge.relation} ({edge.deltaSeconds}s)</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
