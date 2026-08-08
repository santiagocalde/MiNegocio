import asyncio
import json
import logging
import time
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
        self._last_touch: dict[int, float] = {}  # id(q) -> timestamp

    def _touch(self, q: asyncio.Queue):
        self._last_touch[id(q)] = time.time()

    def _cleanup_stale(self, max_age: float = 300):
        """Elimina colas sin actividad en N segundos (default 5 min)."""
        now = time.time()
        stale_ids = set()
        for bucket in list(self._clients.values()):
            for q in list(bucket):
                qid = id(q)
                last = self._last_touch.get(qid, 0)
                if now - last > max_age:
                    stale_ids.add(qid)
                    bucket.discard(q)
        self._last_touch = {k: v for k, v in self._last_touch.items() if k not in stale_ids}
        # Limpiar buckets vacíos
        empty = [k for k, v in self._clients.items() if not v]
        for k in empty:
            self._clients.pop(k, None)

    def register(self, business_id: Optional[str] = None) -> asyncio.Queue:
        key = business_id or _LOCAL_KEY
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._clients.setdefault(key, set()).add(q)
        self._touch(q)
        return q

    def unregister(self, q: asyncio.Queue, business_id: Optional[str] = None):
        key = business_id or _LOCAL_KEY
        bucket = self._clients.get(key)
        if bucket:
            bucket.discard(q)
            self._last_touch.pop(id(q), None)
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
                self._touch(q)
            except asyncio.QueueFull:
                stale.append(q)
            except Exception:
                stale.append(q)
        for q in stale:
            bucket.discard(q)
            self._last_touch.pop(id(q), None)
        if not bucket:
            self._clients.pop(key, None)

    def connection_count(self) -> int:
        return sum(len(b) for b in self._clients.values())

    def tenant_counts(self) -> dict:
        self._cleanup_stale(max_age=300)
        return {k: len(v) for k, v in self._clients.items()}


events = EventManager()
