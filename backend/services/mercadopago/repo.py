"""
Acceso a datos del cobro MP (POS), compatible SQLite y PostgreSQL.

Reusa la tabla `payment_intents` (ya existe en ambos motores). Lee la config de
MP del negocio (token + si tiene la auto-confirmación activa) desde business_config.
"""
import logging

logger = logging.getLogger("mercadopago.repo")


def _use_pg() -> bool:
    import main
    return bool(getattr(main, "USE_PG", False))


def _flag(v) -> bool:
    return v in (1, True, "1", "true", "True")


async def get_merchant_settings(business_id: str) -> dict:
    """Devuelve {token, auto_confirm} del negocio (de business_config)."""
    if _use_pg():
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT mp_access_token, mp_auto_confirm FROM business_config WHERE business_id = $1",
                business_id)
            if not row:
                return {"token": "", "auto_confirm": False}
            return {"token": row["mp_access_token"] or "", "auto_confirm": _flag(row["mp_auto_confirm"])}
    else:
        import aiosqlite, main
        async with aiosqlite.connect(main.DB_PATH) as db:
            cur = await db.execute(
                "SELECT key, value FROM business_config WHERE key IN ('mp_access_token','mp_auto_confirm')")
            kv = {k: v for k, v in await cur.fetchall()}
            return {"token": kv.get("mp_access_token", ""), "auto_confirm": _flag(kv.get("mp_auto_confirm"))}


async def get_qr_pos_config(business_id: str) -> dict:
    """Config completa para el QR Presencial (caja fija): token, collector,
    ids externos de sucursal/caja, url del QR fijo y si auto_confirm está activo."""
    if _use_pg():
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT mp_access_token, mp_collector_id, mp_external_store_id, "
                "mp_external_pos_id, mp_qr_pos_url, mp_auto_confirm "
                "FROM business_config WHERE business_id = $1", business_id)
            if not row:
                return {"token": "", "collector_id": "", "external_store_id": "",
                        "external_pos_id": "", "qr_pos_url": "", "auto_confirm": False}
            return {
                "token": row["mp_access_token"] or "",
                "collector_id": row["mp_collector_id"] or "",
                "external_store_id": row["mp_external_store_id"] or "",
                "external_pos_id": row["mp_external_pos_id"] or "",
                "qr_pos_url": row["mp_qr_pos_url"] or "",
                "auto_confirm": _flag(row["mp_auto_confirm"]),
            }
    else:
        import aiosqlite, main
        keys = ("mp_access_token", "mp_collector_id", "mp_external_store_id",
                "mp_external_pos_id", "mp_qr_pos_url", "mp_auto_confirm")
        async with aiosqlite.connect(main.DB_PATH) as db:
            ph = ",".join("?" for _ in keys)
            cur = await db.execute(f"SELECT key, value FROM business_config WHERE key IN ({ph})", keys)
            kv = {k: v for k, v in await cur.fetchall()}
        return {
            "token": kv.get("mp_access_token", ""),
            "collector_id": kv.get("mp_collector_id", ""),
            "external_store_id": kv.get("mp_external_store_id", ""),
            "external_pos_id": kv.get("mp_external_pos_id", ""),
            "qr_pos_url": kv.get("mp_qr_pos_url", ""),
            "auto_confirm": _flag(kv.get("mp_auto_confirm")),
        }


async def save_qr_pos_config(business_id: str, *, collector_id: str,
                             external_store_id: str, external_pos_id: str, qr_pos_url: str) -> None:
    """Guarda los datos de la caja fija tras crearla en MP."""
    if _use_pg():
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE business_config SET mp_collector_id = $2, mp_external_store_id = $3, "
                "mp_external_pos_id = $4, mp_qr_pos_url = $5 WHERE business_id = $1",
                business_id, collector_id, external_store_id, external_pos_id, qr_pos_url)
    else:
        import aiosqlite, main
        async with aiosqlite.connect(main.DB_PATH) as db:
            for k, v in (("mp_collector_id", collector_id),
                         ("mp_external_store_id", external_store_id),
                         ("mp_external_pos_id", external_pos_id),
                         ("mp_qr_pos_url", qr_pos_url)):
                await db.execute(
                    "INSERT INTO business_config (key, value) VALUES (?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (k, v))
            await db.commit()


async def create_intent(business_id: str, intent_id: str, total: float, description: str) -> None:
    if _use_pg():
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "INSERT INTO payment_intents (id, business_id, total, description, status, external_ref) "
                "VALUES ($1,$2,$3,$4,'pending',$1)",
                intent_id, business_id, total, description)
    else:
        import aiosqlite, main
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute(
                "INSERT INTO payment_intents (id, business_id, total, description, status, external_ref) "
                "VALUES (?,?,?,?,'pending',?)",
                (intent_id, business_id, total, description, intent_id))
            await db.commit()


async def get_intent(business_id: str, intent_id: str) -> dict | None:
    if _use_pg():
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM payment_intents WHERE id = $1 AND business_id = $2", intent_id, business_id)
            return dict(row) if row else None
    else:
        import aiosqlite, main
        async with aiosqlite.connect(main.DB_PATH) as db:
            db.row_factory = aiosqlite.Row
            cur = await db.execute(
                "SELECT * FROM payment_intents WHERE id = ? AND business_id = ?", (intent_id, business_id))
            row = await cur.fetchone()
            return dict(row) if row else None


async def mark_approved(business_id: str, intent_id: str, mp_payment_id: str) -> None:
    if _use_pg():
        from db_helpers import get_pg_pool
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE payment_intents SET status='approved', mp_payment_id=$3, updated_at=now() "
                "WHERE id=$1 AND business_id=$2 AND status='pending'",
                intent_id, business_id, mp_payment_id)
    else:
        import aiosqlite, main
        async with aiosqlite.connect(main.DB_PATH) as db:
            await db.execute(
                "UPDATE payment_intents SET status='approved', mp_payment_id=?, updated_at=datetime('now') "
                "WHERE id=? AND business_id=? AND status='pending'",
                (mp_payment_id, intent_id, business_id))
            await db.commit()
