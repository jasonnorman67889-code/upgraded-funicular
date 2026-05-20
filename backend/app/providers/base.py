from abc import ABC, abstractmethod

from app.models import CorrelatedEvent, IdentityEvent, RiskScore


class ProviderAdapter(ABC):
    name: str

    @abstractmethod
    def ingest(self, payload: dict) -> list[IdentityEvent]:
        raise NotImplementedError

    @abstractmethod
    def normalize(self, events: list[IdentityEvent]) -> list[IdentityEvent]:
        raise NotImplementedError

    @abstractmethod
    def correlate(self, events: list[IdentityEvent]) -> list[CorrelatedEvent]:
        raise NotImplementedError

    @abstractmethod
    def score(self, events: list[CorrelatedEvent]) -> list[RiskScore]:
        raise NotImplementedError

    @abstractmethod
    def respond(self, scores: list[RiskScore]) -> list[dict]:
        raise NotImplementedError
