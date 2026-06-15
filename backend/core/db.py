# DEPRECATED - This module is no longer used.
# Tenant isolation is now implemented via _tenant_aware_connect monkey-patch
# in main.py. This file kept only as reference.
# Scheduled for removal: next deploy cycle.

import aiosqlite
import re

class TenantDBConnection:
    """
    Wrapper de aiosqlite que inyecta automáticamente el 'business_id' en todas
    las consultas SQL para asegurar Aislamiento de Tenant (Tenant Isolation)
    en un modelo SaaS de un solo archivo (Single-DB Multi-Tenant).
    """
    def __init__(self, db_path: str, business_id: str):
        self.db_path = db_path
        self.business_id = business_id
        self._conn = None

    async def __aenter__(self):
        self._conn = await aiosqlite.connect(self.db_path)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self._conn.close()

    def _inject_tenant(self, sql: str, params: tuple) -> tuple:
        sql_upper = sql.upper()
        return sql, params

    async def execute(self, sql: str, parameters=None):
        parameters = parameters or ()
        sql, parameters = self._inject_tenant(sql, parameters)
        return await self._conn.execute(sql, parameters)

    async def executescript(self, sql_script: str):
        return await self._conn.executescript(sql_script)

    async def commit(self):
        await self._conn.commit()
        
    async def rollback(self):
        await self._conn.rollback()

def get_tenant_db(db_path: str, business_id: str):
    return TenantDBConnection(db_path, business_id)
