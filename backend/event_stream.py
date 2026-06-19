import asyncio
import json
import logging
import time
from typing import Any

logger = logging.getLogger("NovaStock.SSE")

class EventManager:
    def __init__(self):
        self._clients: set[asyncio.Queue] = set()

    def register(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._clients.add(q)
        return q

    def unregister(self, q: asyncio.Queue):
        self._clients.discard(q)

    async def emit(self, event: str, data: Any):
        payload = f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"
        stale = []
        for q in list(self._clients):
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                stale.append(q)
            except Exception:
                stale.append(q)
        for q in stale:
            self._clients.discard(q)
    
    async def cleanup_stale(self):
        """Remove clients that haven't been consumed in 5 minutes"""
        stale = []
        for q in list(self._clients):
            if q.qsize() > 50:
                stale.append(q)
        for q in stale:
            self._clients.discard(q)

events = EventManager()
