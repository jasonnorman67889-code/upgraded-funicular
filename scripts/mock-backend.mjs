import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, code, payload) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function parseUrl(url) {
  const parsed = new URL(url, "http://localhost");
  return {
    path: parsed.pathname,
    query: Object.fromEntries(parsed.searchParams.entries()),
  };
}

export function startMockBackend({ port = 18000 } = {}) {
  const incidents = [];
  const tasks = [];
  const audit = [];

  function ensureTask(incident) {
    let task = tasks.find((item) => item.incidentId === incident.incidentId);
    if (!task) {
      task = {
        taskId: `task-${randomUUID().slice(0, 8)}`,
        incidentId: incident.incidentId,
        tenantId: incident.tenantId,
        entityId: incident.entityId,
        riskLabel: incident.riskLabel,
        queueId: incident.riskLabel === "Critical" ? "containment-approval" : "tier2-triage",
        status: "pending_approval",
        dueAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      };
      tasks.push(task);
      audit.push({
        auditId: randomUUID(),
        tenantId: incident.tenantId,
        taskId: task.taskId,
        action: "task_created",
        actor: "mock-system",
        timeGenerated: new Date().toISOString(),
      });
    }
    return task;
  }

  const server = createServer(async (req, res) => {
    const { path, query } = parseUrl(req.url || "/");

    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { status: "ok", service: "mock-backend" });
      return;
    }

    if (req.method === "POST" && path === "/pipeline/simulate-attack-chain") {
      const body = await readBody(req);
      const tenantId = body.tenantId || "tenant-a";
      const entityId = body.entityId || "mock-user";
      const incident = {
        incidentId: `inc-${randomUUID().slice(0, 10)}`,
        tenantId,
        entityId,
        riskLabel: "Critical",
        action: "SimulateContainment",
        correlationId: randomUUID().slice(0, 12),
        createdAt: new Date().toISOString(),
        status: "new",
      };
      incidents.unshift(incident);
      const task = ensureTask(incident);
      sendJson(res, 200, {
        incidents: [incident],
        graphEdges: [
          {
            source: "sim-001",
            target: "sim-002",
            entityId,
            relation: "event_sequence",
            deltaSeconds: 120,
          },
        ],
        soarTasks: [task],
      });
      return;
    }

    if (req.method === "GET" && path === "/incidents") {
      const tenantId = query.tenantId || "tenant-a";
      sendJson(res, 200, { tenantId, items: incidents.filter((item) => item.tenantId === tenantId) });
      return;
    }

    if (req.method === "GET" && path === "/soar/tasks") {
      const tenantId = query.tenantId || "tenant-a";
      sendJson(res, 200, { tenantId, items: tasks.filter((item) => item.tenantId === tenantId) });
      return;
    }

    if (req.method === "GET" && path === "/soar/audit") {
      const tenantId = query.tenantId || "tenant-a";
      const taskId = query.taskId;
      const rows = audit.filter((item) => item.tenantId === tenantId && (!taskId || item.taskId === taskId));
      sendJson(res, 200, { tenantId, items: rows });
      return;
    }

    if (req.method === "POST" && path.startsWith("/soar/tasks/") && path.endsWith("/assign")) {
      const taskId = path.split("/")[3];
      const body = await readBody(req);
      const task = tasks.find((item) => item.taskId === taskId);
      if (!task) {
        sendJson(res, 404, { detail: "Task not found" });
        return;
      }
      task.assignedTo = body.analyst || "mock-analyst";
      task.status = "assigned";
      audit.unshift({
        auditId: randomUUID(),
        tenantId: task.tenantId,
        taskId,
        action: "assigned",
        actor: task.assignedTo,
        timeGenerated: new Date().toISOString(),
      });
      sendJson(res, 200, task);
      return;
    }

    if (req.method === "POST" && path.startsWith("/soar/tasks/") && path.endsWith("/approve")) {
      const taskId = path.split("/")[3];
      const body = await readBody(req);
      const task = tasks.find((item) => item.taskId === taskId);
      if (!task) {
        sendJson(res, 404, { detail: "Task not found" });
        return;
      }
      task.status = "approved";
      audit.unshift({
        auditId: randomUUID(),
        tenantId: task.tenantId,
        taskId,
        action: "approved",
        actor: body.actor || "mock-approver",
        timeGenerated: new Date().toISOString(),
      });
      sendJson(res, 200, task);
      return;
    }

    if (req.method === "POST" && path.startsWith("/soar/tasks/") && path.endsWith("/execute")) {
      const taskId = path.split("/")[3];
      const body = await readBody(req);
      const task = tasks.find((item) => item.taskId === taskId);
      if (!task) {
        sendJson(res, 404, { detail: "Task not found" });
        return;
      }
      task.status = "completed";
      audit.unshift({
        auditId: randomUUID(),
        tenantId: task.tenantId,
        taskId,
        action: "executed",
        actor: body.actor || "mock-bot",
        timeGenerated: new Date().toISOString(),
      });
      sendJson(res, 200, task);
      return;
    }

    sendJson(res, 404, { detail: "Not found" });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      resolve({
        port,
        close: () =>
          new Promise((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}
