import { useEffect, useState } from "react";

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

type TaskActionInput = {
  analyst: string;
  actor: string;
  note: string;
  executor: string;
};

export function SoarWorkflowPanel({
  queues,
  tasks,
  audit,
  onAssign,
  onApprove,
  onReject,
  onExecute,
  onEscalate,
  onRefresh,
  taskActionState,
}: {
  queues: SoarQueue[];
  tasks: SoarTask[];
  audit: SoarAudit[];
  onAssign: (taskId: string, analyst: string) => void;
  onApprove: (taskId: string, actor: string, note: string) => void;
  onReject: (taskId: string, actor: string, note: string) => void;
  onExecute: (taskId: string, actor: string) => void;
  onEscalate: () => void;
  onRefresh: () => void;
  taskActionState: Record<string, TaskActionState>;
}) {
  const [inputsByTask, setInputsByTask] = useState<Record<string, TaskActionInput>>({});

  useEffect(() => {
    setInputsByTask((prev) => {
      const next = { ...prev };
      for (const task of tasks) {
        if (!next[task.taskId]) {
          next[task.taskId] = {
            analyst: "analyst-local",
            actor: "lead-analyst",
            note: "",
            executor: "automation-local",
          };
        }
      }
      return next;
    });
  }, [tasks]);

  function updateInput(taskId: string, patch: Partial<TaskActionInput>) {
    setInputsByTask((prev) => ({
      ...prev,
      [taskId]: {
        analyst: prev[taskId]?.analyst || "analyst-local",
        actor: prev[taskId]?.actor || "lead-analyst",
        note: prev[taskId]?.note || "",
        executor: prev[taskId]?.executor || "automation-local",
        ...patch,
      },
    }));
  }

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium">SOAR Workflow Engine</div>
        <div className="flex gap-2">
          <button className="rounded border border-cyan-300/30 px-2 py-1 text-xs hover:bg-cyan-400/10" onClick={onEscalate}>
            Run Escalation
          </button>
          <button className="rounded border border-cyan-300/30 px-2 py-1 text-xs hover:bg-cyan-400/10" onClick={onRefresh}>
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="rounded border border-white/10 p-2">
          <div className="mb-2 text-xs font-semibold">Queues</div>
          <div className="space-y-2 text-xs">
            {queues.map((queue) => (
              <div key={queue.queueId} className="rounded border border-white/10 p-2">
                <div className="font-medium">{queue.name}</div>
                <div className="text-slate-400">SLA {queue.slaMinutes}m · Open {queue.openTasks}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-white/10 p-2">
          <div className="mb-2 text-xs font-semibold">Tasks</div>
          <div className="max-h-64 space-y-2 overflow-auto text-xs">
            {tasks.length === 0 ? <div className="text-slate-400">No SOAR tasks.</div> : null}
            {tasks.map((task) => (
              <div key={task.taskId} className="rounded border border-white/10 p-2">
                {taskActionState[task.taskId]?.message ? (
                  <div
                    className={`mb-2 rounded px-2 py-1 text-[11px] ${
                      taskActionState[task.taskId]?.level === "error"
                        ? "border border-red-300/40 bg-red-500/10 text-red-100"
                        : taskActionState[task.taskId]?.level === "success"
                          ? "border border-emerald-300/40 bg-emerald-500/10 text-emerald-100"
                          : "border border-cyan-300/40 bg-cyan-500/10 text-cyan-100"
                    }`}
                  >
                    {taskActionState[task.taskId]?.message}
                  </div>
                ) : null}
                <div className="font-medium">{task.taskId}</div>
                <div>{task.incidentId} · {task.riskLabel}</div>
                <div className="text-slate-400">{task.queueId} · {task.status}</div>
                <div className="text-slate-500">Due {new Date(task.dueAt).toLocaleTimeString()}</div>
                <div className="mt-2 grid grid-cols-1 gap-1 md:grid-cols-2">
                  <input
                    className="rounded border border-white/20 bg-slate-900/60 px-2 py-1 text-xs"
                    value={inputsByTask[task.taskId]?.analyst || "analyst-local"}
                    onChange={(event) => updateInput(task.taskId, { analyst: event.target.value })}
                    placeholder="assignee"
                  />
                  <input
                    className="rounded border border-white/20 bg-slate-900/60 px-2 py-1 text-xs"
                    value={inputsByTask[task.taskId]?.executor || "automation-local"}
                    onChange={(event) => updateInput(task.taskId, { executor: event.target.value })}
                    placeholder="executor"
                  />
                  <input
                    className="rounded border border-white/20 bg-slate-900/60 px-2 py-1 text-xs"
                    value={inputsByTask[task.taskId]?.actor || "lead-analyst"}
                    onChange={(event) => updateInput(task.taskId, { actor: event.target.value })}
                    placeholder="approver/rejector"
                  />
                  <input
                    className="rounded border border-white/20 bg-slate-900/60 px-2 py-1 text-xs"
                    value={inputsByTask[task.taskId]?.note || ""}
                    onChange={(event) => updateInput(task.taskId, { note: event.target.value })}
                    placeholder="decision note"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    className="rounded border border-cyan-300/30 px-2 py-0.5 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={Boolean(taskActionState[task.taskId]?.pendingAction)}
                    onClick={() => onAssign(task.taskId, inputsByTask[task.taskId]?.analyst || "analyst-local")}
                  >
                    {taskActionState[task.taskId]?.pendingAction === "assign" ? "assigning..." : "assign"}
                  </button>
                  <button
                    className="rounded border border-emerald-300/30 px-2 py-0.5 hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={Boolean(taskActionState[task.taskId]?.pendingAction)}
                    onClick={() =>
                      onApprove(
                        task.taskId,
                        inputsByTask[task.taskId]?.actor || "lead-analyst",
                        inputsByTask[task.taskId]?.note || ""
                      )
                    }
                  >
                    {taskActionState[task.taskId]?.pendingAction === "approve" ? "approving..." : "approve"}
                  </button>
                  <button
                    className="rounded border border-amber-300/30 px-2 py-0.5 hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={Boolean(taskActionState[task.taskId]?.pendingAction)}
                    onClick={() =>
                      onReject(
                        task.taskId,
                        inputsByTask[task.taskId]?.actor || "lead-analyst",
                        inputsByTask[task.taskId]?.note || ""
                      )
                    }
                  >
                    {taskActionState[task.taskId]?.pendingAction === "reject" ? "rejecting..." : "reject"}
                  </button>
                  <button
                    className="rounded border border-red-300/30 px-2 py-0.5 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={Boolean(taskActionState[task.taskId]?.pendingAction)}
                    onClick={() => onExecute(task.taskId, inputsByTask[task.taskId]?.executor || "automation-local")}
                  >
                    {taskActionState[task.taskId]?.pendingAction === "execute" ? "executing..." : "execute"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-white/10 p-2">
          <div className="mb-2 text-xs font-semibold">Audit Trail</div>
          <div className="max-h-64 space-y-2 overflow-auto text-xs">
            {audit.length === 0 ? <div className="text-slate-400">No audit entries.</div> : null}
            {audit.map((row) => (
              <div key={row.auditId} className="rounded border border-white/10 p-2">
                <div className="font-medium">{row.action}</div>
                <div>{row.taskId}</div>
                <div className="text-slate-400">{row.actor} · {new Date(row.timeGenerated).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
