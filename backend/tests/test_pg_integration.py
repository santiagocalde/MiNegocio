"""
Tests de integración contra PostgreSQL real + smoke de seguridad.

A diferencia del resto de la suite (que corre en SQLite, ver conftest.py), estos
tests pegan contra un PostgreSQL real para validar el path de producción:
  - init_pg() crea todo el schema en una DB limpia.
  - el runner de migraciones aplica una vez y es idempotente.
  - la unificación de JWT_SECRET (todos los módulos comparten el mismo).
  - el key_func de rate limit usa la IP real detrás del proxy.

SEGURIDAD: nunca tocan la DB de producción. Crean y destruyen una base
descartable `minegocio_test`. Si no hay PostgreSQL accesible, se saltean (skip),
así la suite sigue verde en un entorno de dev solo-SQLite.
"""
import os
import asyncio
import pytest
import asyncpg

# --- Resolver conexión al PG (sin DATABASE_URL de prod) ---
PG_HOST = os.getenv("PG_HOST", "localhost")
PG_PORT = int(os.getenv("PG_PORT", "5432"))
PG_USER = os.getenv("PG_USER", "minegocio")
PG_PASSWORD = os.getenv("PG_PASSWORD", "1234")
PG_BASE_DB = os.getenv("PG_DATABASE", "minegocio")
TEST_DB = "minegocio_test"

_admin_dsn = f"postgresql://{PG_USER}:{PG_PASSWORD}@{PG_HOST}:{PG_PORT}/{PG_BASE_DB}"
_test_dsn = f"postgresql://{PG_USER}:{PG_PASSWORD}@{PG_HOST}:{PG_PORT}/{TEST_DB}"


async def _pg_reachable() -> bool:
    try:
        conn = await asyncpg.connect(dsn=_admin_dsn, timeout=4)
        await conn.close()
        return True
    except Exception:
        return False


pg_available = asyncio.get_event_loop_policy().new_event_loop().run_until_complete(_pg_reachable())

pytestmark = pytest.mark.skipif(
    not pg_available,
    reason="PostgreSQL no accesible — tests de integración PG omitidos",
)


@pytest.fixture
async def test_db():
    """Crea una DB descartable, configura db.py para apuntar ahí, y la destruye."""
    # CREATE DATABASE no puede correr en transacción; asyncpg.execute autocommitea.
    admin = await asyncpg.connect(dsn=_admin_dsn)
    await admin.execute(f"DROP DATABASE IF EXISTS {TEST_DB}")
    await admin.execute(f"CREATE DATABASE {TEST_DB}")
    await admin.close()

    import db
    prev_url, prev_pool = db.DATABASE_URL, db._pool
    db.DATABASE_URL = _test_dsn
    db._pool = None

    yield

    if db._pool is not None:
        await db._pool.close()
    db.DATABASE_URL, db._pool = prev_url, prev_pool

    admin = await asyncpg.connect(dsn=_admin_dsn)
    # Cortar conexiones colgadas antes de dropear.
    await admin.execute(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
        "WHERE datname = $1 AND pid <> pg_backend_pid()", TEST_DB
    )
    await admin.execute(f"DROP DATABASE IF EXISTS {TEST_DB}")
    await admin.close()


async def test_init_pg_crea_schema_completo(test_db):
    """init_pg() debe crear todas las tablas core en una base limpia."""
    import db
    await db.init_pg()
    pool = await db.get_pool()
    async with pool.acquire() as conn:
        for tabla in ("businesses", "products", "sales", "sale_items",
                      "customers", "superadmins", "schema_migrations"):
            existe = await conn.fetchval("SELECT to_regclass($1)", f"public.{tabla}")
            assert existe is not None, f"Falta la tabla {tabla}"


async def test_migration_runner_aplica_e_idempotente(test_db, tmp_path, monkeypatch):
    """El runner aplica una migración pendiente una sola vez y no la repite."""
    import db
    await db.init_pg()

    # Carpeta de migraciones temporal con una migración de prueba.
    monkeypatch.setattr(db, "MIGRATIONS_DIR", str(tmp_path))
    (tmp_path / "0001_test.pg.sql").write_text(
        "CREATE TABLE IF NOT EXISTS _t_runner (id INT);"
    )

    await db.run_migrations_pg()
    pool = await db.get_pool()
    async with pool.acquire() as conn:
        assert await conn.fetchval("SELECT to_regclass('public._t_runner')") is not None
        n1 = await conn.fetchval("SELECT COUNT(*) FROM schema_migrations WHERE id='0001_test'")
        assert n1 == 1

    # Segunda corrida: NO debe duplicar el registro ni fallar.
    await db.run_migrations_pg()
    async with pool.acquire() as conn:
        n2 = await conn.fetchval("SELECT COUNT(*) FROM schema_migrations WHERE id='0001_test'")
        assert n2 == 1, "El runner re-aplicó una migración ya registrada"


def test_jwt_secret_unificado():
    """Todos los módulos deben compartir el mismo JWT_SECRET (core.config)."""
    from core.config import JWT_SECRET
    from core.jwt_helpers import JWT_SECRET as j_helpers
    assert JWT_SECRET == j_helpers


def test_rate_limit_usa_ip_real():
    """real_client_ip prioriza X-Real-IP sobre la IP del proxy (client.host)."""
    from core.ratelimit import real_client_ip

    class _Req:
        def __init__(self, headers, host):
            self.headers = headers
            self.client = type("C", (), {"host": host})()

    # Con X-Real-IP gana la IP real, no la del proxy.
    r = _Req({"x-real-ip": "190.2.3.4"}, "172.18.0.5")
    assert real_client_ip(r) == "190.2.3.4"
    # Sin headers de proxy, cae a client.host.
    r2 = _Req({}, "10.0.0.9")
    assert real_client_ip(r2) == "10.0.0.9"
