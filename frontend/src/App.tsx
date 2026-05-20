import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Shield } from "lucide-react";

import { EntityInvestigationWorkspace } from "./components/EntityInvestigationWorkspace";
import { MetricCard } from "./components/MetricCard";
import { SoarWorkflowPanel } from "./components/SoarWorkflowPanel";
import { workbookConfig } from "./data/workbook";
import {
  approveSoarTask,
  assignSoarTask,
  executeSoarTask,
  getIncidents,
  getSoarAudit,
  getSoarQueues,
  getSoarTasks,
  queryAnalytics,
  rejectSoarTask,
  runAttackChainSimulation,
  runSoarEscalations,
  updateIncidentStatus,
} from "./lib/api";

const LazyEntityGraph = lazy(() => import("./components/EntityGraph").then((module) => ({ default: module.EntityGraph })));
const LazyIncidentQueue = lazy(() => import("./components/IncidentQueue").then((module) => ({ default: module.IncidentQueue })));
const LazyLiveRiskChart = lazy(() => import("./components/LiveRiskChart").then((module) => ({ default: module.LiveRiskChart })));
const LazyMitreHeatmap = lazy(() => import("./components/MitreHeatmap").then((module) => ({ default: module.MitreHeatmap })));
const LazyWorkbookRenderer = lazy(() =>
  import("./components/WorkbookRenderer").then((module) => ({ default: module.WorkbookRenderer }))
);

type StreamEvent = {
  eventId: string;
  tenantId: string;
  entityId: string;
  eventType: string;
  riskScore: number;
  timeGenerated: string;
};

type Incident = {
  incidentId: string;
  entityId: string;
  riskLabel: string;
  action: string;
  status?: string;
};

type GraphEdge = {
  source: string;
  target: string;
  entityId: string;
  relation: string;
  deltaSeconds: number;
};

type SoarQueue = {
  queueId: string;
  name: string;
  slaMinutes: number;
  openTasks: number;
};

type SoarTask = {
  taskId: string;
  incidentId: string;
  riskLabel: string;
  queueId: string;
  status: string;
  assignedTo?: string | null;
  dueAt: string;
};

type SoarAudit = {
  auditId: string;
  taskId: string;
  action: string;
  actor: string;
  timeGenerated: string;
};

type TaskActionState = {
  pendingAction?: "assign" | "approve" | "reject" | "execute";
  message?: string;
  level?: "success" | "error" | "info";
};

const views = [
  "Executive Overview Dashboard",
  "Identity Fusion Dashboard",
  "Incident Command Dashboard",
  "Live Attack Timeline",
  "Entity Investigation Workspace",
  "ML Risk Analytics",
  "Detection Coverage Heatmap",
  "MITRE ATT&CK Mapping",
  "OAuth Abuse Monitor",
  "Spam -> Identity Correlation Center",
];

export function App() {
  const [tenantId, setTenantId] = useState("tenant-a");
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [graphEdges, setGraphEdges] = useState<GraphEdge[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedView, setSelectedView] = useState(views[0]);
  const [selectedEntity, setSelectedEntity] = useState("user-simulated");
  const [impossibleTravelCount, setImpossibleTravelCount] = useState(0);
  const [soarQueues, setSoarQueues] = useState<SoarQueue[]>([]);
  const [soarTasks, setSoarTasks] = useState<SoarTask[]>([]);
  const [soarAudit, setSoarAudit] = useState<SoarAudit[]>([]);
  const [soarMessage, setSoarMessage] = useState("");
  const [taskActionState, setTaskActionState] = useState<Record<string, TaskActionState>>({});

  useEffect(() => {
    const timers: number[] = [];
    for (const [taskId, state] of Object.entries(taskActionState)) {
      if (state.level === "success" && !state.pendingAction) {
        const timerId = window.setTimeout(() => {
          setTaskActionState((prev) => {
            const current = prev[taskId];
            if (!current || current.level !== "success" || current.pendingAction) {
              return prev;
            }
            const next = { ...prev };
            delete next[taskId];
            return next;
          });
        }, 4000);
        timers.push(timerId);
      }
    }

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [taskActionState]);

  useEffect(() => {
    const ws = new WebSocket(import.meta.env.VITE_WS_URL || "ws://localhost:8020/stream");
    ws.onmessage = (msg) => {
      const payload = JSON.parse(msg.data);
      if (payload.type === "stream_event") {
        setEvents((prev) => [payload.data, ...prev].slice(0, 80));
      }
    };
    return () => ws.close();
  }, []);

  useEffect(() => {
    getIncidents(tenantId).then((data) => setIncidents(data.items || [])).catch(() => setIncidents([]));
    refreshSoarData(tenantId);
  }, [tenantId]);

  useEffect(() => {
    if (events.length > 0 && !events.find((event) => event.entityId === selectedEntity)) {
      setSelectedEntity(events[0].entityId);
    }
  }, [events, selectedEntity]);

  useEffect(() => {
    queryAnalytics(
      tenantId,
      "IdentityEvents | where eventType == 'ImpossibleTravel' | summarize count()",
      events
    ).then((rows) => {
      const count = rows?.[0]?.count_ ?? 0;
      setImpossibleTravelCount(count);
    });
  }, [events, tenantId]);

  const filteredEvents = useMemo(() => events.filter((event) => event.tenantId === tenantId), [events, tenantId]);

  const critical = useMemo(() => filteredEvents.filter((event) => event.riskScore >= 0.8).length, [filteredEvents]);
  const avgRisk = useMemo(() => {
    if (!filteredEvents.length) return 0;
    return filteredEvents.reduce((sum, event) => sum + event.riskScore, 0) / filteredEvents.length;
  }, [filteredEvents]);

  const oauthAbuse = useMemo(
    () => filteredEvents.filter((event) => event.eventType.includes("OAuth") || event.eventType.includes("Token")).length,
    [filteredEvents]
  );

  const spamIdentityConvergence = useMemo(
    () => filteredEvents.filter((event) => event.eventType === "MfaFatigue" || event.eventType === "ImpossibleTravel").length,
    [filteredEvents]
  );

  async function onSimulateAttackChain() {
    const result = await runAttackChainSimulation(tenantId, "user-simulated");
    setGraphEdges(result.graphEdges || []);
    setIncidents((prev) => [...(result.incidents || []), ...prev].slice(0, 50));
    await refreshSoarData(tenantId);
  }

  async function onStatusChange(incidentId: string, status: string) {
    await updateIncidentStatus(incidentId, status);
    const refreshed = await getIncidents(tenantId);
    setIncidents(refreshed.items || []);
    await refreshSoarData(tenantId);
  }

  async function refreshSoarData(scopeTenantId: string) {
    const [queuesRes, tasksRes, auditRes] = await Promise.all([
      getSoarQueues(scopeTenantId),
      getSoarTasks(scopeTenantId),
      getSoarAudit(scopeTenantId),
    ]);
    setSoarQueues(queuesRes.items || []);
    setSoarTasks(tasksRes.items || []);
    setSoarAudit((auditRes.items || []).slice(0, 40));
  }

  function appendOptimisticAudit(taskId: string, action: string, actor: string) {
    setSoarAudit((prev) => [
      {
        auditId: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        taskId,
        action,
        actor,
        timeGenerated: new Date().toISOString(),
      },
      ...prev,
    ].slice(0, 40));
  }

  function patchTask(taskId: string, patch: Partial<SoarTask>) {
    setSoarTasks((prev) => prev.map((task) => (task.taskId === taskId ? { ...task, ...patch } : task)));
  }

  function setTaskPending(taskId: string, pendingAction: TaskActionState["pendingAction"], message: string) {
    setTaskActionState((prev) => ({
      ...prev,
      [taskId]: {
        pendingAction,
        message,
        level: "info",
      },
    }));
  }

  function setTaskResult(taskId: string, level: TaskActionState["level"], message: string) {
    setTaskActionState((prev) => ({
      ...prev,
      [taskId]: {
        pendingAction: undefined,
        message,
        level,
      },
    }));
  }

  async function onAssignTask(taskId: string, analyst: string) {
    const previousTasks = [...soarTasks];
    patchTask(taskId, { assignedTo: analyst, status: "assigned" });
    appendOptimisticAudit(taskId, "assigned", analyst);
    setTaskPending(taskId, "assign", `Assigning to ${analyst}`);
    setSoarMessage(`Assigned ${taskId} to ${analyst}`);
    try {
      await assignSoarTask(taskId, analyst);
      setTaskResult(taskId, "success", `Assigned to ${analyst}`);
    } catch (_error) {
      setSoarTasks(previousTasks);
      setTaskResult(taskId, "error", "Assign failed");
      setSoarMessage(`Assign failed for ${taskId}`);
    }
    await refreshSoarData(tenantId);
  }

  async function onApproveTask(taskId: string, actor: string, note: string) {
    const previousTasks = [...soarTasks];
    patchTask(taskId, { status: "approved" });
    appendOptimisticAudit(taskId, "approved", actor);
    setTaskPending(taskId, "approve", `Approving by ${actor}`);
    setSoarMessage(`Approved ${taskId}`);
    try {
      await approveSoarTask(taskId, actor, note);
      setTaskResult(taskId, "success", "Approved");
    } catch (_error) {
      setSoarTasks(previousTasks);
      setTaskResult(taskId, "error", "Approve failed");
      setSoarMessage(`Approve failed for ${taskId}`);
    }
    await refreshSoarData(tenantId);
  }

  async function onRejectTask(taskId: string, actor: string, note: string) {
    const previousTasks = [...soarTasks];
    patchTask(taskId, { status: "rejected" });
    appendOptimisticAudit(taskId, "rejected", actor);
    setTaskPending(taskId, "reject", `Rejecting by ${actor}`);
    setSoarMessage(`Rejected ${taskId}`);
    try {
      await rejectSoarTask(taskId, actor, note);
      setTaskResult(taskId, "success", "Rejected");
    } catch (_error) {
      setSoarTasks(previousTasks);
      setTaskResult(taskId, "error", "Reject failed");
      setSoarMessage(`Reject failed for ${taskId}`);
    }
    await refreshSoarData(tenantId);
  }

  async function onExecuteTask(taskId: string, actor: string) {
    const previousTasks = [...soarTasks];
    patchTask(taskId, { status: "completed" });
    appendOptimisticAudit(taskId, "executed", actor);
    setTaskPending(taskId, "execute", `Executing by ${actor}`);
    setSoarMessage(`Executed ${taskId}`);
    try {
      await executeSoarTask(taskId, actor);
      setTaskResult(taskId, "success", "Executed");
    } catch (_error) {
      setSoarTasks(previousTasks);
      setTaskResult(taskId, "error", "Execution failed");
      setSoarMessage(`Execution failed for ${taskId}`);
    }
    await refreshSoarData(tenantId);
  }

  async function onRunEscalation() {
    setSoarMessage("Running escalation checks...");
    await runSoarEscalations(tenantId);
    setSoarMessage("Escalation check complete");
    await refreshSoarData(tenantId);
  }

  return (
    <div className="min-h-screen p-6 md:p-8">
      <header className="mb-6 flex flex-col gap-3 rounded-xl border border-cyan-200/10 bg-panel/70 p-4 shadow-glow backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Identity Fusion Command Center</h1>
          <p className="text-sm text-slate-300">Sovereign SOC local simulation mode</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded border border-cyan-200/30 bg-slate-900/70 px-2 py-1 text-sm"
            value={tenantId}
            onChange={(event) => setTenantId(event.target.value)}
          >
            <option value="tenant-a">tenant-a</option>
            <option value="tenant-b">tenant-b</option>
          </select>
          <button className="rounded border border-cyan-300/40 px-3 py-1 text-sm hover:bg-cyan-400/10" onClick={onSimulateAttackChain}>
            Simulate Attack Chain
          </button>
          <Shield className="text-accent" />
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        {views.map((view) => (
          <button
            key={view}
            className={`rounded-full border px-3 py-1 text-xs ${selectedView === view ? "border-cyan-300 bg-cyan-500/20" : "border-white/20"}`}
            onClick={() => setSelectedView(view)}
          >
            {view}
          </button>
        ))}
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard title="Live Events" value={filteredEvents.length} hint="WebSocket stream" />
        <MetricCard title="Critical Alerts" value={critical} hint="Risk >= 0.80" />
        <MetricCard title="Average Risk" value={avgRisk.toFixed(2)} hint="ML aggregate" />
        <MetricCard title="Impossible Travel" value={impossibleTravelCount} hint="KQL-lite query" />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard title="OAuth Abuse Monitor" value={oauthAbuse} hint="Token/OAuth anomalies" />
        <MetricCard title="Spam -> Identity Correlation" value={spamIdentityConvergence} hint="Cross-signal convergence" />
        <MetricCard title="Current View" value={selectedView} hint="Dashboard focus" />
      </section>

      <Suspense fallback={<div className="mt-6 text-sm text-slate-300">Loading dashboard panel...</div>}>
        {(selectedView === "Executive Overview Dashboard" || selectedView === "ML Risk Analytics") && (
          <section className="mt-6">
            <LazyLiveRiskChart events={filteredEvents} />
          </section>
        )}

        {selectedView === "Identity Fusion Dashboard" && (
          <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <LazyLiveRiskChart events={filteredEvents} />
            <LazyEntityGraph edges={graphEdges} />
          </section>
        )}

        {selectedView === "Incident Command Dashboard" && (
          <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <LazyIncidentQueue incidents={incidents} onStatusChange={onStatusChange} />
            <div className="space-y-2">
              {soarMessage ? (
                <div className="rounded border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                  {soarMessage}
                </div>
              ) : null}
              <SoarWorkflowPanel
                queues={soarQueues}
                tasks={soarTasks}
                audit={soarAudit}
                onAssign={onAssignTask}
                onApprove={onApproveTask}
                onReject={onRejectTask}
                onExecute={onExecuteTask}
                onEscalate={onRunEscalation}
                onRefresh={() => refreshSoarData(tenantId)}
                taskActionState={taskActionState}
              />
            </div>
          </section>
        )}

        {selectedView === "Live Attack Timeline" && (
          <section className="mt-6 rounded-xl border border-white/10 bg-panel/60 p-4 backdrop-blur">
            <h2 className="mb-3 text-lg font-semibold">Live Attack Timeline</h2>
            <div className="max-h-72 space-y-2 overflow-auto">
              {filteredEvents.map((event) => (
                <div key={event.eventId} className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-950/40 p-3">
                  <div>
                    <div className="font-medium">{event.eventType}</div>
                    <div className="text-xs text-slate-400">{event.entityId} · {event.tenantId}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">Risk {event.riskScore.toFixed(2)}</div>
                    <div className="text-xs text-slate-500">{new Date(event.timeGenerated).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {selectedView === "Entity Investigation Workspace" && (
          <section className="mt-6">
            <EntityInvestigationWorkspace
              selectedEntity={selectedEntity}
              events={filteredEvents}
              edges={graphEdges}
              onEntityChange={setSelectedEntity}
            />
          </section>
        )}

        {(selectedView === "Detection Coverage Heatmap" || selectedView === "MITRE ATT&CK Mapping") && (
          <section className="mt-6">
            <LazyMitreHeatmap />
          </section>
        )}

        {(selectedView === "OAuth Abuse Monitor" || selectedView === "Spam -> Identity Correlation Center") && (
          <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <LazyLiveRiskChart events={filteredEvents} />
            <LazyEntityGraph edges={graphEdges} />
          </section>
        )}

        <LazyWorkbookRenderer workbook={workbookConfig} />
      </Suspense>
    </div>
  );
}
