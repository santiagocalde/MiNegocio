import os
import aiosqlite
import asyncpg
from typing import Optional, Any

USE_PG = bool(os.getenv("DATABASE_URL", ""))

_db_path: Optional[str] = None


def set_db_path(path: str):
    global _db_path
    _db_path = path


async def get_pg_pool() -> asyncpg.Pool:
    """Alias del pool canónico en db.py — un solo pool para toda la app."""
    from db import get_pool
    return await get_pool()


async def close_pg():
    from db import close_pool
    await close_pool()


def row_to_dict(row, description=None):
    if row is None: return None
    if hasattr(row, '_mapping'): return dict(row._mapping)
    if hasattr(row, 'keys') and callable(row.keys):
        try: return dict(row)
        except: pass
    if description:
        return {description[i][0]: v for i, v in enumerate(row)}
    return dict(row)


def tenanted_query(sql: str, business_id: Optional[str]) -> str:
    return sql


async def pg_fetch(sql: str, *params, business_id: Optional[str] = None):
    pool = await get_pg_pool()
    async with pool.acquire() as conn:
        if business_id:
            rows = await conn.fetch(sql, business_id, *params)
        else:
            rows = await conn.fetch(sql, *params)
        return [dict(r) for r in rows]


async def pg_fetchrow(sql: str, *params, business_id: Optional[str] = None):
    pool = await get_pg_pool()
    async with pool.acquire() as conn:
        if business_id:
            row = await conn.fetchrow(sql, business_id, *params)
        else:
            row = await conn.fetchrow(sql, *params)
        return dict(row) if row else None


async def pg_fetchval(sql: str, *params, business_id: Optional[str] = None):
    pool = await get_pg_pool()
    async with pool.acquire() as conn:
        if business_id:
            val = await conn.fetchval(sql, business_id, *params)
        else:
            val = await conn.fetchval(sql, *params)
        return val


async def pg_execute(sql: str, *params, business_id: Optional[str] = None):
    pool = await get_pg_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            if business_id:
                await conn.execute(sql, business_id, *params)
            else:
                await conn.execute(sql, *params)


async def pg_execute_returning(sql: str, *params, business_id: Optional[str] = None) -> Optional[dict]:
    pool = await get_pg_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            if business_id:
                row = await conn.fetchrow(sql, business_id, *params)
            else:
                row = await conn.fetchrow(sql, *params)
            return dict(row) if row else None
