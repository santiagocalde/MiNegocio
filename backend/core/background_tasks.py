"""
Background tasks: billing grace period y trial email reminders.
Se inician desde el lifespan de main.py.
"""
import asyncio
import logging
import os

import aiosqlite

logger = logging.getLogger("NovaStock")

USE_PG   = bool(os.getenv("DATABASE_URL", ""))
DB_PATH  = os.getenv("DB_PATH") or os.path.join(os.path.dirname(__file__), "..", "data", "minegocio.db")


async def check_trial_emails() -> None:
    """Envía emails de recordatorio cada 2 días durante el trial y al expirar (día 7)."""
    from services.email_service import send_trial_reminder
    while True:
        try:
            if USE_PG:
                from db_helpers import get_pg_pool
                pool = await get_pg_pool()
                async with pool.acquire() as conn:
                    reminders_active = await conn.fetch("""
                        SELECT id, email, business_name,
                               (CURRENT_DATE - DATE(created_at)) AS days_passed
                        FROM businesses
                        WHERE plan = 'trial'
                          AND (CURRENT_DATE - DATE(created_at)) IN (2, 4, 6)
                    """)
                    for b in reminders_active:
                        days_left = 7 - int(b["days_passed"])
                        await send_trial_reminder(b["email"], b["business_name"], days_left)

                    reminders_7d = await conn.fetch(
                        "SELECT id, email, business_name FROM businesses "
                        "WHERE plan = 'trial' AND DATE(created_at) = CURRENT_DATE - INTERVAL '7 days'"
                    )
                    for b in reminders_7d:
                        await send_trial_reminder(b["email"], b["business_name"], 0)
            logger.info("Tarea de emails de prueba completada.")
        except Exception as e:
            logger.error(f"Error en tarea de emails de prueba: {e}")
        await asyncio.sleep(86400)


async def check_billing_grace_period() -> None:
    """Suspende cuentas vencidas: past_due a los 3 días, suspended a los 15, expired si trial > 7 días."""
    while True:
        try:
            if USE_PG:
                from db_helpers import get_pg_pool
                pool = await get_pg_pool()
                async with pool.acquire() as conn:
                    async with conn.transaction():
                        await conn.execute("""
                            UPDATE businesses SET status = 'past_due', updated_at = now()
                            WHERE status = 'active' AND plan != 'trial' AND plan_end_date IS NOT NULL
                              AND plan_end_date + interval '3 days' <= now()
                        """)
                        await conn.execute("""
                            UPDATE businesses SET status = 'suspended', updated_at = now()
                            WHERE status IN ('active', 'past_due') AND plan != 'trial' AND plan_end_date IS NOT NULL
                              AND plan_end_date + interval '15 days' <= now()
                        """)
                        await conn.execute("""
                            UPDATE businesses SET status = 'expired', updated_at = now()
                            WHERE status = 'active' AND plan = 'trial'
                              AND created_at + interval '7 days' <= now()
                        """)
            else:
                async with aiosqlite.connect(DB_PATH) as db:
                    await db.execute("BEGIN IMMEDIATE")
                    await db.execute(
                        "UPDATE businesses SET status = 'past_due', updated_at = datetime('now','localtime') "
                        "WHERE status = 'active' AND plan != 'trial' AND plan_end_date IS NOT NULL "
                        "AND date(plan_end_date, '+3 days') <= date('now')"
                    )
                    await db.execute(
                        "UPDATE businesses SET status = 'suspended', updated_at = datetime('now','localtime') "
                        "WHERE status IN ('active', 'past_due') AND plan != 'trial' AND plan_end_date IS NOT NULL "
                        "AND date(plan_end_date, '+15 days') <= date('now')"
                    )
                    await db.execute(
                        "UPDATE businesses SET status = 'expired', updated_at = datetime('now','localtime') "
                        "WHERE status = 'active' AND plan = 'trial' AND date(created_at, '+7 days') <= date('now')"
                    )
                    await db.commit()
            logger.info("Grace period task completada.")
        except Exception as e:
            logger.error(f"Error en grace period task: {e}")
        await asyncio.sleep(3600)
