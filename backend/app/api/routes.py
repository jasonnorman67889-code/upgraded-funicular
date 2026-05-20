import os
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.pipeline import FusionPipelineService, score_with_ml_engine
from app.services.incident_store import incident_store
from app.services.kql_lite import run_kql_lite
from app.services.soar import soar_workflow
from app.services.synthetic import generate_attack_chain

router = APIRouter()
service = FusionPipelineService()


class IngestRequest(BaseModel):
    provider: str = Field(default="EntraID")
    tenantId: str = Field(default="tenant-local")
    events: list[dict]


class IncidentStatusRequest(BaseModel):
    status: str = Field(description="new|triage|in_progress|contained|closed")


class AnalyticsQueryRequest(BaseModel):
    tenantId: str = Field(default="tenant-local")
    query: str
    rows: list[dict] = Field(default_factory=list)


class SimulateChainRequest(BaseModel):
    provider: str = Field(default="EntraID")
    tenantId: str = Field(default="tenant-local")
    entityId: str = Field(default="user-simulated")


class TaskAssignRequest(BaseModel):
    analyst: str


class TaskDecisionRequest(BaseModel):
    actor: str
    note: str = ""


class TaskExecuteRequest(BaseModel):
    actor: str


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "identity-fusion-backend", "time": datetime.utcnow().isoformat() + "Z"}


@router.post("/pipeline/ingest")
async def ingest(request: IngestRequest) -> dict:
    try:
        result = service.run_from_payload(request.provider, request.model_dump())
        result["mlEnriched"] = await score_with_ml_engine(
            result["scores"], os.getenv("ML_ENGINE_URL", "http://ml-engine:8010")
        )
        incident_store.upsert_many(result["incidents"])
        result["soarTasks"] = soar_workflow.ensure_tasks_for_incidents(result["incidents"])
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/pipeline/mock-run")
async def mock_run(provider: str = "EntraID", tenantId: str = "tenant-local") -> dict:
    result = service.run_with_local_dataset(provider, tenantId)
    result["mlEnriched"] = await score_with_ml_engine(result["scores"], os.getenv("ML_ENGINE_URL", "http://ml-engine:8010"))
    incident_store.upsert_many(result["incidents"])
    result["soarTasks"] = soar_workflow.ensure_tasks_for_incidents(result["incidents"])
    return result


@router.get("/incidents")
def list_incidents(tenantId: str = "tenant-local") -> dict:
    return {"tenantId": tenantId, "items": incident_store.list_by_tenant(tenantId)}


@router.patch("/incidents/{incident_id}/status")
def update_incident_status(incident_id: str, request: IncidentStatusRequest) -> dict:
    item = incident_store.update_status(incident_id, request.status)
    if item is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    soar_workflow.sync_incident_status(item)
    return item


@router.post("/analytics/query")
def analytics_query(request: AnalyticsQueryRequest) -> dict:
    tenant_rows = [row for row in request.rows if row.get("tenantId") == request.tenantId]
    return {"results": run_kql_lite(request.query, tenant_rows), "tenantId": request.tenantId}


@router.post("/pipeline/simulate-attack-chain")
async def simulate_attack_chain(request: SimulateChainRequest) -> dict:
    payload = {
        "provider": request.provider,
        "tenantId": request.tenantId,
        "events": generate_attack_chain(request.tenantId, request.entityId),
    }
    result = service.run_from_payload(request.provider, payload)
    result["mlEnriched"] = await score_with_ml_engine(result["scores"], os.getenv("ML_ENGINE_URL", "http://ml-engine:8010"))
    incident_store.upsert_many(result["incidents"])
    result["soarTasks"] = soar_workflow.ensure_tasks_for_incidents(result["incidents"])
    return result


@router.get("/soar/queues")
def list_soar_queues(tenantId: str = "tenant-local") -> dict:
    return {"tenantId": tenantId, "items": soar_workflow.list_queues(tenantId)}


@router.get("/soar/tasks")
def list_soar_tasks(tenantId: str = "tenant-local", queueId: str | None = None) -> dict:
    return {"tenantId": tenantId, "items": soar_workflow.list_tasks(tenantId, queueId)}


@router.post("/soar/tasks/{task_id}/assign")
def assign_soar_task(task_id: str, request: TaskAssignRequest) -> dict:
    item = soar_workflow.assign_task(task_id, request.analyst)
    if item is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return item


@router.post("/soar/tasks/{task_id}/approve")
def approve_soar_task(task_id: str, request: TaskDecisionRequest) -> dict:
    item = soar_workflow.approve_task(task_id, request.actor, request.note)
    if item is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return item


@router.post("/soar/tasks/{task_id}/reject")
def reject_soar_task(task_id: str, request: TaskDecisionRequest) -> dict:
    item = soar_workflow.reject_task(task_id, request.actor, request.note)
    if item is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return item


@router.post("/soar/tasks/{task_id}/execute")
def execute_soar_task(task_id: str, request: TaskExecuteRequest) -> dict:
    item = soar_workflow.execute_task(task_id, request.actor)
    if item is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return item


@router.post("/soar/escalations/run")
def run_soar_escalations(tenantId: str = "tenant-local") -> dict:
    items = soar_workflow.escalate_due_tasks(tenantId)
    return {"tenantId": tenantId, "escalated": items, "count": len(items)}


@router.get("/soar/audit")
def list_soar_audit(tenantId: str = "tenant-local", taskId: str | None = None) -> dict:
    return {"tenantId": tenantId, "items": soar_workflow.list_audit(tenantId, taskId)}
