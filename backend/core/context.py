"""
ContextVar compartido para el business_id del tenant activo.
Importar desde aquí para evitar ciclos de importación con main.py.
"""
import contextvars

business_id_ctx: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "business_id_ctx", default=None
)
