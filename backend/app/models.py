from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class IdentityEvent(BaseModel):
    eventId: str
    tenantId: str
    entityId: str
    provider: str
    eventType: str
    ip: str | None = None
    country: str | None = None
    accountType: str | None = "Standard"
    timeGenerated: datetime
    details: dict[str, Any] = Field(default_factory=dict)


class CorrelatedEvent(BaseModel):
    correlationId: str
    baseEvent: IdentityEvent
    relatedSignals: list[str] = Field(default_factory=list)


class RiskScore(BaseModel):
    correlationId: str
    entityId: str
    riskScore: float
    riskLabel: str
    factors: list[str] = Field(default_factory=list)


class Incident(BaseModel):
    incidentId: str
    tenantId: str
    entityId: str
    riskLabel: str
    action: str
    correlationId: str
    createdAt: datetime
