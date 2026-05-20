from datetime import datetime
from hashlib import sha1

from app.models import CorrelatedEvent, IdentityEvent, RiskScore
from app.providers.base import ProviderAdapter


class GenericMockProvider(ProviderAdapter):
    def __init__(self, name: str):
        self.name = name

    def ingest(self, payload: dict) -> list[IdentityEvent]:
        raw_events = payload.get("events", [])
        return [IdentityEvent(**event) for event in raw_events]

    def normalize(self, events: list[IdentityEvent]) -> list[IdentityEvent]:
        return events

    def correlate(self, events: list[IdentityEvent]) -> list[CorrelatedEvent]:
        output: list[CorrelatedEvent] = []
        for event in events:
            correlation_id = sha1(f"{event.entityId}:{event.timeGenerated.isoformat()}".encode()).hexdigest()[:12]
            related = []
            if event.eventType in {"ImpossibleTravel", "MfaFatigue", "TokenReplay", "PasswordSpray"}:
                related.append("IdentityAnomaly")
            output.append(CorrelatedEvent(correlationId=correlation_id, baseEvent=event, relatedSignals=related))
        return output

    def score(self, events: list[CorrelatedEvent]) -> list[RiskScore]:
        scores: list[RiskScore] = []
        for evt in events:
            base = 0.2
            et = evt.baseEvent.eventType
            if et in {"ImpossibleTravel", "TokenReplay", "SessionHijack"}:
                base += 0.5
            if et in {"MfaFatigue", "PasswordSpray", "OAuthPersistence"}:
                base += 0.35
            if evt.baseEvent.accountType in {"Privileged", "Executive"}:
                base += 0.15
            label = "Low"
            if base >= 0.8:
                label = "Critical"
            elif base >= 0.6:
                label = "High"
            elif base >= 0.4:
                label = "Medium"
            scores.append(
                RiskScore(
                    correlationId=evt.correlationId,
                    entityId=evt.baseEvent.entityId,
                    riskScore=min(base, 1.0),
                    riskLabel=label,
                    factors=[et] + evt.relatedSignals,
                )
            )
        return scores

    def respond(self, scores: list[RiskScore]) -> list[dict]:
        actions = []
        for score in scores:
            action = "Observe"
            if score.riskLabel == "High":
                action = "QueueAnalystReview"
            elif score.riskLabel == "Critical":
                action = "SimulateContainment"
            actions.append(
                {
                    "correlationId": score.correlationId,
                    "entityId": score.entityId,
                    "recommendedAction": action,
                    "decisionAt": datetime.utcnow().isoformat() + "Z",
                }
            )
        return actions


def build_provider_registry() -> dict[str, ProviderAdapter]:
    names = [
        "MicrosoftSentinel",
        "AzureMonitor",
        "MicrosoftGraph",
        "EntraID",
        "Okta",
        "CrowdStrike",
        "DefenderXDR",
        "Splunk",
        "Elastic",
        "GoogleWorkspace",
        "AWSCloudTrail",
    ]
    return {name: GenericMockProvider(name) for name in names}
