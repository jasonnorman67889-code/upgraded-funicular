from collections import defaultdict
from typing import Callable


class LocalEventBus:
    def __init__(self):
        self._handlers: dict[str, list[Callable]] = defaultdict(list)

    def subscribe(self, topic: str, handler: Callable) -> None:
        self._handlers[topic].append(handler)

    def publish(self, topic: str, payload: dict) -> None:
        for handler in self._handlers.get(topic, []):
            handler(payload)
