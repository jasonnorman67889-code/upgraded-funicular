from datetime import datetime
from threading import Lock


class IncidentStore:
    def __init__(self):
        self._incidents: dict[str, dict] = {}
        self._lock = Lock()

    def upsert_many(self, incidents: list[dict]) -> None:
        with self._lock:
            for incident in incidents:
                existing = self._incidents.get(incident["incidentId"])
                if existing:
                    existing["lastUpdatedAt"] = datetime.utcnow().isoformat() + "Z"
                    existing["riskLabel"] = incident["riskLabel"]
                    existing["action"] = incident["action"]
                else:
                    incident["status"] = "new"
                    incident["createdAt"] = incident["createdAt"]
                    incident["lastUpdatedAt"] = datetime.utcnow().isoformat() + "Z"
                    self._incidents[incident["incidentId"]] = incident

    def list_by_tenant(self, tenant_id: str) -> list[dict]:
        with self._lock:
            return [i for i in self._incidents.values() if i["tenantId"] == tenant_id]

    def update_status(self, incident_id: str, status: str) -> dict | None:
        with self._lock:
            item = self._incidents.get(incident_id)
            if not item:
                return None
            item["status"] = status
            item["lastUpdatedAt"] = datetime.utcnow().isoformat() + "Z"
            return item


incident_store = IncidentStore()
