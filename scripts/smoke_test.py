import json
import os
import sys
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


BASE_URL = os.getenv("SMOKE_BASE_URL", "http://localhost:8000")
TENANT_ID = os.getenv("SMOKE_TENANT_ID", "tenant-a")
ENTITY_ID = os.getenv("SMOKE_ENTITY_ID", "smoke-user")


def call_api(method: str, path: str, payload: dict[str, Any] | None = None) -> Any:
    data = None
    headers = {"Content-Type": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    request = Request(f"{BASE_URL}{path}", data=data, headers=headers, method=method)
    try:
        with urlopen(request, timeout=20) as response:
            body = response.read().decode("utf-8")
            if not body:
                return {}
            return json.loads(body)
    except HTTPError as err:
        body = err.read().decode("utf-8") if err.fp else ""
        raise RuntimeError(f"HTTP {err.code} {method} {path}: {body}") from err
    except URLError as err:
        raise RuntimeError(f"Network error {method} {path}: {err}") from err


def wait_for_health(max_wait_seconds: int = 120) -> None:
    start = time.time()
    while time.time() - start < max_wait_seconds:
        try:
            response = call_api("GET", "/health")
            if response.get("status") == "ok":
                print("[ok] backend health endpoint reachable")
                return
        except Exception:
            pass
        time.sleep(2)
    raise RuntimeError("Backend health check timed out")


def assert_condition(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def main() -> int:
    print(f"Smoke test target: {BASE_URL}")
    wait_for_health()

    simulation = call_api(
        "POST",
        "/pipeline/simulate-attack-chain",
        {"provider": "EntraID", "tenantId": TENANT_ID, "entityId": ENTITY_ID},
    )
    incidents = simulation.get("incidents", [])
    assert_condition(len(incidents) > 0, "No incidents generated from attack-chain simulation")
    print(f"[ok] simulation generated {len(incidents)} incident(s)")

    incidents_payload = call_api("GET", f"/incidents?{urlencode({'tenantId': TENANT_ID})}")
    incident_items = incidents_payload.get("items", [])
    assert_condition(len(incident_items) > 0, "No incidents found in incident store")
    print(f"[ok] incident store contains {len(incident_items)} item(s)")

    tasks_payload = call_api("GET", f"/soar/tasks?{urlencode({'tenantId': TENANT_ID})}")
    tasks = tasks_payload.get("items", [])
    assert_condition(len(tasks) > 0, "No SOAR tasks found after incident creation")
    task = tasks[0]
    task_id = task["taskId"]
    print(f"[ok] operating on SOAR task {task_id}")

    call_api("POST", f"/soar/tasks/{task_id}/assign", {"analyst": "smoke-analyst"})
    call_api("POST", f"/soar/tasks/{task_id}/approve", {"actor": "smoke-lead", "note": "smoke approval"})
    call_api("POST", f"/soar/tasks/{task_id}/execute", {"actor": "smoke-bot"})
    print("[ok] assign/approve/execute sequence completed")

    audit_payload = call_api("GET", f"/soar/audit?{urlencode({'tenantId': TENANT_ID, 'taskId': task_id})}")
    audit_items = audit_payload.get("items", [])
    actions = {item.get("action") for item in audit_items}

    assert_condition("assigned" in actions, "SOAR audit missing assigned action")
    assert_condition("approved" in actions, "SOAR audit missing approved action")
    assert_condition("executed" in actions, "SOAR audit missing executed action")
    print(f"[ok] audit trail validated for task {task_id}")

    print("Smoke test completed successfully")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[fail] {exc}")
        raise SystemExit(1)
