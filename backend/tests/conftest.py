"""
Configuración compartida de la suite de tests.

Fuerza modo local/SQLite ANTES de que cualquier test importe `main`, así los
tests corren igual en un entorno de desarrollo (sin DATABASE_URL) que dentro del
contenedor de producción (que sí tiene DATABASE_URL y SAAS_MODE=true).

Sin esto, dentro del contenedor `USE_PG`/`SAAS_MODE` se leerían del entorno de
prod y los tests pegarían contra PostgreSQL y el middleware multi-tenant.
"""
import os

os.environ["SAAS_MODE"] = "false"
os.environ["DATABASE_URL"] = ""
os.environ["APP_ENV"] = "test"
