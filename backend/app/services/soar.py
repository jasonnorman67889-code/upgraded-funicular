from datetime import datetime, timedelta
from threading import Lock
from uuid import uuid4


class SoarWorkflowService:
    def __init__(self) -> None:
        self._lock = Lock()
        self._tasks: dict[str, dict] = {}
        self._task_by_incident: dict[str, str] = {}
        self._audit: list[dict] = []
        self._queues = {
            "tier2-triage": {"name": "Tier 2 Triage", "slaMinutes": 20},
            "containment-approval": {"name": "Containment Approval", "slaMinutes": 10},
            "executive-escalation": {"name": "Executive Escalation", "slaMinutes": 5},
        }

    @staticmethod
    def _utc_now() -> datetime:
        return datetime.utcnow()

    @staticmethod
    def _risk_priority(risk_label: str) -> int:
        order = {"low": 1, "medium": 2, "high": 3, "critical": 4}
        return order.get(risk_label.lower(), 1)

    def _choose_queue(self, incident: dict) -> str:
        if incident.get("riskLabel", "").lower() == "critical":
            if incident.get("entityId", "").startswith("exec-"):
                return "executive-escalation"
            return "containment-approval"
        return "tier2-triage"

    def _append_audit(self, tenant_id: str, task_id: str, action: str, actor: str, details: dict | None = None) -> None:
        self._audit.append(
            {
                "auditId": str(uuid4()),
                "tenantId": tenant_id,
                "taskId": task_id,
                "action": action,
                "actor": actor,
                "details": details or {},
                "timeGenerated": self._utc_now().isoformat() + "Z",
            }
        )

    def ensure_tasks_for_incidents(self, incidents: list[dict]) -> list[dict]:
        created: list[dict] = []
        with self._lock:
            for incident in incidents:
                incident_id = incident["incidentId"]
                risk = incident.get("riskLabel", "Low")
                if self._risk_priority(risk) < 3:
                    continue

                existing_id = self._task_by_incident.get(incident_id)
                if existing_id:
                    task = self._tasks[existing_id]
                    task["riskLabel"] = risk
                    task["lastUpdatedAt"] = self._utc_now().isoformat() + "Z"
                    continue

                queue_id = self._choose_queue(incident)
                due_at = self._utc_now() + timedelta(minutes=self._queues[queue_id]["slaMinutes"])
                task_id = f"task-{uuid4().hex[:10]}"
                task = {
                    "taskId": task_id,
                    "incidentId": incident_id,
                    "tenantId": incident["tenantId"],
                    "entityId": incident["entityId"],
                    "riskLabel": risk,
                    "queueId": queue_id,
                    "status": "pending_approval",
                    "assignedTo": None,
                    "approvedBy": None,
                    "executionState": "not_started",
                    "escalated": False,
                    "dueAt": due_at.isoformat() + "Z",
                    "createdAt": self._utc_now().isoformat() + "Z",
                    "lastUpdatedAt": self._utc_now().isoformat() + "Z",
                }
                self._tasks[task_id] = task
                self._task_by_incident[incident_id] = task_id
                self._append_audit(incident["tenantId"], task_id, "task_created", "system", {"queueId": queue_id})
                created.append(task)
        return created

    def list_queues(self, tenant_id: str) -> list[dict]:
        with self._lock:
            queue_counts = {queue_id: 0 for queue_id in self._queues}
            for task in self._tasks.values():
                if task["tenantId"] != tenant_id:
                    continue
                queue_counts[task["queueId"]] += 1

            return [
                {
                    "queueId": queue_id,
                    "name": cfg["name"],
                    "slaMinutes": cfg["slaMinutes"],
                    "openTasks": queue_counts[queue_id],
                }
                for queue_id, cfg in self._queues.items()
            ]

    def list_tasks(self, tenant_id: str, queue_id: str | None = None) -> list[dict]:
        with self._lock:
            tasks = [task for task in self._tasks.values() if task["tenantId"] == tenant_id]
            if queue_id:
                tasks = [task for task in tasks if task["queueId"] == queue_id]
            return sorted(tasks, key=lambda item: item["createdAt"], reverse=True)

    def _get_task(self, task_id: str) -> dict | None:
        return self._tasks.get(task_id)

    def assign_task(self, task_id: str, analyst: str) -> dict | None:
        with self._lock:
            task = self._get_task(task_id)
            if not task:
                return None
            task["assignedTo"] = analyst
            task["status"] = "assigned"
            task["lastUpdatedAt"] = self._utc_now().isoformat() + "Z"
            self._append_audit(task["tenantId"], task_id, "assigned", analyst)
            return task

    def approve_task(self, task_id: str, approver: str, note: str = "") -> dict | None:
        with self._lock:
            task = self._get_task(task_id)
            if not task:
                return None
            task["status"] = "approved"
            task["approvedBy"] = approver
            task["lastUpdatedAt"] = self._utc_now().isoformat() + "Z"
            self._append_audit(task["tenantId"], task_id, "approved", approver, {"note": note})
            return task

    def reject_task(self, task_id: str, approver: str, reason: str = "") -> dict | None:
        with self._lock:
            task = self._get_task(task_id)
            if not task:
                return None
            task["status"] = "rejected"
            task["lastUpdatedAt"] = self._utc_now().isoformat() + "Z"
            self._append_audit(task["tenantId"], task_id, "rejected", approver, {"reason": reason})
            return task

    def execute_task(self, task_id: str, actor: str) -> dict | None:
        with self._lock:
            task = self._get_task(task_id)
            if not task:
                return None
            task["executionState"] = "executed"
            task["status"] = "completed"
            task["lastUpdatedAt"] = self._utc_now().isoformat() + "Z"
            self._append_audit(task["tenantId"], task_id, "executed", actor)
            return task

    def escalate_due_tasks(self, tenant_id: str) -> list[dict]:
        escalated: list[dict] = []
        now = self._utc_now()
        with self._lock:
            for task in self._tasks.values():
                if task["tenantId"] != tenant_id:
                    continue
                if task["status"] in {"completed", "rejected"}:
                    continue
                due = datetime.fromisoformat(task["dueAt"].replace("Z", ""))
                if due <= now and not task["escalated"]:
                    task["escalated"] = True
                    task["status"] = "escalated"
                    task["lastUpdatedAt"] = now.isoformat() + "Z"
                    self._append_audit(tenant_id, task["taskId"], "escalated", "system", {"reason": "sla_breach"})
                    escalated.append(task)
        return escalated

    def sync_incident_status(self, incident: dict) -> dict | None:
        incident_id = incident.get("incidentId")
        if not incident_id:
            return None
        with self._lock:
            task_id = self._task_by_incident.get(incident_id)
            if not task_id:
                return None
            task = self._tasks[task_id]
            status = incident.get("status", "")
            if status in {"contained", "closed"}:
                task["status"] = "completed"
                task["executionState"] = "executed"
                task["lastUpdatedAt"] = self._utc_now().isoformat() + "Z"
                self._append_audit(task["tenantId"], task_id, "incident_synced", "system", {"incidentStatus": status})
            return task

    def list_audit(self, tenant_id: str, task_id: str | None = None) -> list[dict]:
        with self._lock:
            rows = [row for row in self._audit if row["tenantId"] == tenant_id]
            if task_id:
                rows = [row for row in rows if row["taskId"] == task_id]
            return sorted(rows, key=lambda row: row["timeGenerated"], reverse=True)


soar_workflow = SoarWorkflowService()
