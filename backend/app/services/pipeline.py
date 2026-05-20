import json
from pathlib import Path
from datetime import datetime

import httpx

from app.models import Incident
from app.providers.mock_providers import build_provider_registry
from app.services.identity_graph import IdentityGraphEngine


class FusionPipelineService:
    def __init__(self):
        self.providers = build_provider_registry()
        self.mock_data_path = Path("/mock-data/identity_events.json")
        self.graph_engine = IdentityGraphEngine()

    @staticmethod
    def _enforce_tenant_isolation(events: list, tenant_id: str) -> list:
        return [event for event in events if event.tenantId == tenant_id]

    def run_from_payload(self, provider_name: str, payload: dict) -> dict:
        provider = self.providers.get(provider_name)
        if provider is None:
            raise ValueError(f"Unknown provider: {provider_name}")

        ingested = provider.ingest(payload)
        tenant_id = payload.get("tenantId", "tenant-local")
        ingested = self._enforce_tenant_isolation(ingested, tenant_id)
        normalized = provider.normalize(ingested)
        correlated = provider.correlate(normalized)
        graph_edges = self.graph_engine.build_edges(normalized)
        correlated = self.graph_engine.attach_graph_signals(correlated, graph_edges)
        scored = provider.score(correlated)
        responses = provider.respond(scored)

        incidents = []
        for score, response in zip(scored, responses):
            incidents.append(
                Incident(
                    incidentId=f"inc-{score.correlationId}",
                    tenantId=tenant_id,
                    entityId=score.entityId,
                    riskLabel=score.riskLabel,
                    action=response["recommendedAction"],
                    correlationId=score.correlationId,
                    createdAt=datetime.utcnow(),
                ).model_dump(mode="json")
            )

        return {
            "provider": provider_name,
            "ingested": [event.model_dump(mode="json") for event in ingested],
            "correlated": [event.model_dump(mode="json") for event in correlated],
            "graphEdges": graph_edges,
            "scores": [score.model_dump(mode="json") for score in scored],
            "responses": responses,
            "incidents": incidents,
        }

    def run_with_local_dataset(self, provider_name: str, tenant_id: str = "tenant-local") -> dict:
        with open(self.mock_data_path, "r", encoding="utf-8") as handle:
            events = json.load(handle)
        payload = {"tenantId": tenant_id, "events": events}
        return self.run_from_payload(provider_name, payload)


async def score_with_ml_engine(scores: list[dict], ml_engine_url: str) -> list[dict]:
    if not scores:
        return []
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(f"{ml_engine_url}/ml/aggregate-risk", json={"scores": scores})
        response.raise_for_status()
        return response.json().get("enriched", [])
