type Incident = {
  incidentId: string;
  entityId: string;
  riskLabel: string;
  action: string;
  status?: string;
};

export function IncidentQueue({
  incidents,
  onStatusChange,
}: {
  incidents: Incident[];
  onStatusChange: (incidentId: string, status: string) => void;
}) {
  const statuses = ["new", "triage", "in_progress", "contained", "closed"];

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <div className="mb-2 text-sm font-medium">Incident Command Dashboard</div>
      <div className="max-h-64 overflow-auto space-y-2 text-xs">
        {incidents.length === 0 ? <div className="text-slate-400">No incidents yet.</div> : null}
        {incidents.map((incident) => (
          <div key={incident.incidentId} className="rounded border border-white/10 p-2">
            <div className="font-semibold">{incident.incidentId}</div>
            <div>{incident.entityId} · {incident.riskLabel}</div>
            <div className="text-slate-400">Action: {incident.action}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {statuses.map((status) => (
                <button
                  key={status}
                  className="rounded border border-cyan-300/30 px-2 py-0.5 hover:bg-cyan-400/10"
                  onClick={() => onStatusChange(incident.incidentId, status)}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
