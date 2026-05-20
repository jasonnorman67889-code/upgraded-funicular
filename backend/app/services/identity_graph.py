from collections import defaultdict

from app.models import CorrelatedEvent, IdentityEvent


class IdentityGraphEngine:
    def build_edges(self, events: list[IdentityEvent]) -> list[dict]:
        edges: list[dict] = []
        by_entity: dict[str, list[IdentityEvent]] = defaultdict(list)
        for event in events:
            by_entity[event.entityId].append(event)

        for entity_id, entity_events in by_entity.items():
            entity_events.sort(key=lambda e: e.timeGenerated)
            for idx in range(1, len(entity_events)):
                prev = entity_events[idx - 1]
                curr = entity_events[idx]
                edges.append(
                    {
                        "source": prev.eventId,
                        "target": curr.eventId,
                        "entityId": entity_id,
                        "relation": "event_sequence",
                        "deltaSeconds": int((curr.timeGenerated - prev.timeGenerated).total_seconds()),
                    }
                )
        return edges

    def attach_graph_signals(self, correlated: list[CorrelatedEvent], edges: list[dict]) -> list[CorrelatedEvent]:
        edge_count_by_entity: dict[str, int] = defaultdict(int)
        for edge in edges:
            edge_count_by_entity[edge["entityId"]] += 1

        enriched: list[CorrelatedEvent] = []
        for item in correlated:
            signals = list(item.relatedSignals)
            if edge_count_by_entity[item.baseEvent.entityId] >= 2:
                signals.append("MultiStepActivity")
            enriched.append(item.model_copy(update={"relatedSignals": list(dict.fromkeys(signals))}))
        return enriched
