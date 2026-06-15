import asyncio
import json
import logging
from typing import Any

logger = logging.getLogger("NovaStock.SSE")

class EventManager:
    def __init__(self):
        self._clients: set[asyncio.Queue] = set()

    def register(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._clients.add(q)
        return q

    def unregister(self, q: asyncio.Queue):
        self._clients.discard(q)

    async def emit(self, event: str, data: Any):
        payload = f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"
        for q in list(self._clients):
            try:
                await q.put(payload)
            except Exception:
                self._clients.discard(q)

events = EventManager()
