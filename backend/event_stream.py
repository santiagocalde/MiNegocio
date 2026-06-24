import asyncio
import json
import logging
from typing import Any, Optional

logger = logging.getLogger("NovaStock.SSE")

# Clave usada en modo offline / single-tenant (sin business_id)
_LOCAL_KEY = "__local__"


class EventManager:
    """
    Pub/sub en memoria para SSE, particionado por tenant.

    Antes era un único set global: cada evento se empujaba a TODAS las
    conexiones de TODOS los kioscos (O(N^2) de tráfico + fuga de aislamiento).
    Ahora las colas se agrupan por business_id y emit() solo notifica al
    tenant correspondiente.
    """

    def __init__(self):
        self._clients: dict[str, set[asyncio.Queue]] = {}

    def register(self, business_id: Optional[str] = None) -> asyncio.Queue:
        key = business_id or _LOCAL_KEY
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._clients.setdefault(key, set()).add(q)
        return q

    def unregister(self, q: asyncio.Queue, business_id: Optional[str] = None):
        key = business_id or _LOCAL_KEY
        bucket = self._clients.get(key)
        if bucket:
            bucket.discard(q)
            if not bucket:
                self._clients.pop(key, None)

    async def emit(self, event: str, data: Any, business_id: Optional[str] = None):
        key = business_id or _LOCAL_KEY
        bucket = self._clients.get(key)
        if not bucket:
            return
        payload = f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"
        stale = []
        for q in list(bucket):
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                stale.append(q)
            except Exception:
                stale.append(q)
        for q in stale:
            bucket.discard(q)
        if not bucket:
            self._clients.pop(key, None)

    def connection_count(self) -> int:
        return sum(len(b) for b in self._clients.values())


events = EventManager()
