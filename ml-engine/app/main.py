from statistics import mean

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Identity Fusion ML Engine", version="0.1.0")


class AggregateRiskRequest(BaseModel):
    scores: list[dict]


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "identity-fusion-ml-engine"}


@app.post("/ml/aggregate-risk")
def aggregate_risk(request: AggregateRiskRequest) -> dict:
    enriched = []
    values = []
    for score in request.scores:
        base = float(score.get("riskScore", 0.0))
        values.append(base)
        trust = max(0.0, 1.0 - base)
        enriched.append(
            {
                **score,
                "identityTrustScore": round(trust, 3),
                "triageRecommendation": "Escalate" if base >= 0.6 else "Monitor",
                "attackPathPrediction": "Likely lateral movement" if base >= 0.8 else "Contained",
            }
        )
    return {
        "enriched": enriched,
        "summary": {
            "count": len(enriched),
            "avgRisk": round(mean(values), 3) if values else 0.0,
            "highRiskCount": len([v for v in values if v >= 0.6]),
        },
    }
