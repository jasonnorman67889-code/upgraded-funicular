const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function getIncidents(tenantId: string): Promise<{ items: any[] }> {
  const res = await fetch(`${API_BASE}/incidents?tenantId=${encodeURIComponent(tenantId)}`);
  if (!res.ok) {
    return { items: [] };
  }
  return res.json();
}

export async function updateIncidentStatus(incidentId: string, status: string): Promise<any> {
  const res = await fetch(`${API_BASE}/incidents/${encodeURIComponent(incidentId)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    throw new Error("Failed to update incident status");
  }
  return res.json();
}

export async function runAttackChainSimulation(tenantId: string, entityId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/pipeline/simulate-attack-chain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId, entityId, provider: "EntraID" }),
  });
  if (!res.ok) {
    throw new Error("Simulation failed");
  }
  return res.json();
}

export async function queryAnalytics(tenantId: string, query: string, rows: any[]): Promise<any[]> {
  const res = await fetch(`${API_BASE}/analytics/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId, query, rows }),
  });
  if (!res.ok) {
    return [];
  }
  const payload = await res.json();
  return payload.results || [];
}

export async function getSoarQueues(tenantId: string): Promise<{ items: any[] }> {
  const res = await fetch(`${API_BASE}/soar/queues?tenantId=${encodeURIComponent(tenantId)}`);
  if (!res.ok) {
    return { items: [] };
  }
  return res.json();
}

export async function getSoarTasks(tenantId: string): Promise<{ items: any[] }> {
  const res = await fetch(`${API_BASE}/soar/tasks?tenantId=${encodeURIComponent(tenantId)}`);
  if (!res.ok) {
    return { items: [] };
  }
  return res.json();
}

export async function assignSoarTask(taskId: string, analyst = "analyst-local"): Promise<any> {
  const res = await fetch(`${API_BASE}/soar/tasks/${encodeURIComponent(taskId)}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ analyst }),
  });
  if (!res.ok) {
    throw new Error("Failed to assign SOAR task");
  }
  return res.json();
}

export async function approveSoarTask(taskId: string, actor = "lead-analyst", note = "approved-local"): Promise<any> {
  const res = await fetch(`${API_BASE}/soar/tasks/${encodeURIComponent(taskId)}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actor, note }),
  });
  if (!res.ok) {
    throw new Error("Failed to approve SOAR task");
  }
  return res.json();
}

export async function rejectSoarTask(taskId: string, actor = "lead-analyst", note = "rejected-local"): Promise<any> {
  const res = await fetch(`${API_BASE}/soar/tasks/${encodeURIComponent(taskId)}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actor, note }),
  });
  if (!res.ok) {
    throw new Error("Failed to reject SOAR task");
  }
  return res.json();
}

export async function executeSoarTask(taskId: string, actor = "automation-local"): Promise<any> {
  const res = await fetch(`${API_BASE}/soar/tasks/${encodeURIComponent(taskId)}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actor }),
  });
  if (!res.ok) {
    throw new Error("Failed to execute SOAR task");
  }
  return res.json();
}

export async function runSoarEscalations(tenantId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/soar/escalations/run?tenantId=${encodeURIComponent(tenantId)}`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error("Failed to run SOAR escalations");
  }
  return res.json();
}

export async function getSoarAudit(tenantId: string): Promise<{ items: any[] }> {
  const res = await fetch(`${API_BASE}/soar/audit?tenantId=${encodeURIComponent(tenantId)}`);
  if (!res.ok) {
    return { items: [] };
  }
  return res.json();
}
