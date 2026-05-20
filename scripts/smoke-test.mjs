import { startMockBackend } from "./mock-backend.mjs";

const CLI_ARGS = new Set(process.argv.slice(2));
const OFFLINE_MODE = CLI_ARGS.has("--offline") || process.env.SMOKE_OFFLINE === "1";
const BASE_URL = process.env.SMOKE_BASE_URL || (OFFLINE_MODE ? "http://localhost:18000" : "http://localhost:8000");
const TENANT_ID = process.env.SMOKE_TENANT_ID || "tenant-a";
const ENTITY_ID = process.env.SMOKE_ENTITY_ID || "smoke-user";

async function callApi(method, path, payload) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${method} ${path}: ${text}`);
  }
  return body;
}

async function waitForHealth(maxWaitMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const health = await callApi("GET", "/health");
      if (health.status === "ok") {
        console.log("[ok] backend health endpoint reachable");
        return;
      }
    } catch {
      // ignore until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Backend health check timed out");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  let mock;
  if (OFFLINE_MODE) {
    mock = await startMockBackend({ port: 18000 });
    console.log("[ok] started in-process mock backend on port 18000");
  }

  console.log(`Smoke test target: ${BASE_URL}`);
  try {
    await waitForHealth();

  const simulation = await callApi("POST", "/pipeline/simulate-attack-chain", {
    provider: "EntraID",
    tenantId: TENANT_ID,
    entityId: ENTITY_ID,
  });

  const incidents = simulation.incidents || [];
  assert(incidents.length > 0, "No incidents generated from attack-chain simulation");
  console.log(`[ok] simulation generated ${incidents.length} incident(s)`);

  const incidentsPayload = await callApi("GET", `/incidents?tenantId=${encodeURIComponent(TENANT_ID)}`);
  const incidentItems = incidentsPayload.items || [];
  assert(incidentItems.length > 0, "No incidents found in incident store");
  console.log(`[ok] incident store contains ${incidentItems.length} item(s)`);

  const tasksPayload = await callApi("GET", `/soar/tasks?tenantId=${encodeURIComponent(TENANT_ID)}`);
  const tasks = tasksPayload.items || [];
  assert(tasks.length > 0, "No SOAR tasks found after incident creation");
  const task = tasks[0];
  const taskId = task.taskId;
  console.log(`[ok] operating on SOAR task ${taskId}`);

  await callApi("POST", `/soar/tasks/${encodeURIComponent(taskId)}/assign`, { analyst: "smoke-analyst" });
  await callApi("POST", `/soar/tasks/${encodeURIComponent(taskId)}/approve`, {
    actor: "smoke-lead",
    note: "smoke approval",
  });
  await callApi("POST", `/soar/tasks/${encodeURIComponent(taskId)}/execute`, { actor: "smoke-bot" });
  console.log("[ok] assign/approve/execute sequence completed");

  const auditPayload = await callApi(
    "GET",
    `/soar/audit?tenantId=${encodeURIComponent(TENANT_ID)}&taskId=${encodeURIComponent(taskId)}`
  );
  const auditItems = auditPayload.items || [];
  const actions = new Set(auditItems.map((row) => row.action));

  assert(actions.has("assigned"), "SOAR audit missing assigned action");
  assert(actions.has("approved"), "SOAR audit missing approved action");
  assert(actions.has("executed"), "SOAR audit missing executed action");
  console.log(`[ok] audit trail validated for task ${taskId}`);

    console.log("Smoke test completed successfully");
  } finally {
    if (mock) {
      await mock.close();
      console.log("[ok] mock backend stopped");
    }
  }
}

main().catch((error) => {
  console.error(`[fail] ${error.message}`);
  process.exit(1);
});
