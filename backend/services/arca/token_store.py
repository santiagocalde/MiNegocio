"""
Persistencia del Ticket de Acceso (TA) de WSAA.

El TA se guarda en la tabla `arca_tokens` (una fila por servicio+ambiente) para
sobrevivir reinicios del backend. Esto es CRÍTICO: si perdiéramos el TA y
volviéramos a pedirlo antes de que expire, ARCA nos bloquea hasta 12h.

Compatibilidad SQL dual (ver CLAUDE.md): funciona con PostgreSQL (SaaS) y
SQLite (local). La facturación ARCA es esencialmente un feature de nube, pero la
tabla existe en ambos motores por consistencia de esquema y para tests locales.
"""
import asyncio
import logging

logger = logging.getLogger("arca.token_store")

# Serializa el refresco del TA: solo un pedido a WSAA a la vez (evita el error de
# ARCA "ya posee un TA valido" por dos refrescos simultáneos).
_refresh_lock = asyncio.Lock()


async def load_ta(service: str, environment: str) -> dict | None:
    """Lee el TA guardado. Devuelve {token, sign, expiration_time} o None."""
    import main

    if getattr(main, "USE_PG", False):
        from db_helpers import get_pg_pool

        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT token, sign, expiration_time FROM arca_tokens "
                "WHERE service = $1 AND environment = $2",
                service, environment,
            )
            return dict(row) if row else None
    else:
        import aiosqlite

        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute(
                "SELECT token, sign, expiration_time FROM arca_tokens "
                "WHERE service = ? AND environment = ?",
                (service, environment),
            )
            row = await cur.fetchone()
            if not row:
                return None
            return {"token": row[0], "sign": row[1], "expiration_time": row[2]}


async def save_ta(service: str, environment: str, ta: dict) -> None:
    """Guarda (upsert) el TA para (service, environment)."""
    import main

    token, sign, exp = ta["token"], ta["sign"], ta.get("expiration_time", "")
    if getattr(main, "USE_PG", False):
        from db_helpers import get_pg_pool

        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO arca_tokens (service, environment, token, sign, expiration_time, updated_at) "
                "VALUES ($1, $2, $3, $4, $5, NOW()) "
                "ON CONFLICT (service, environment) DO UPDATE SET "
                "token = EXCLUDED.token, sign = EXCLUDED.sign, "
                "expiration_time = EXCLUDED.expiration_time, updated_at = NOW()",
                service, environment, token, sign, exp,
            )
    else:
        import aiosqlite

        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute(
                "INSERT INTO arca_tokens (service, environment, token, sign, expiration_time, updated_at) "
                "VALUES (?, ?, ?, ?, ?, datetime('now')) "
                "ON CONFLICT (service, environment) DO UPDATE SET "
                "token = excluded.token, sign = excluded.sign, "
                "expiration_time = excluded.expiration_time, updated_at = datetime('now')",
                (service, environment, token, sign, exp),
            )
            await db.commit()


def refresh_lock() -> asyncio.Lock:
    return _refresh_lock
