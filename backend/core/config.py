"""
Configuración central del backend — única fuente de verdad.

Acá vive el JWT_SECRET (y constantes relacionadas) para que TODOS los módulos
(main, routers, helpers) usen exactamente el mismo valor. Antes cada archivo
hacía su propio os.getenv con su propio default, lo que podía producir tokens
firmados con un secreto y validados con otro si los defaults divergían.

No importar nada de la app acá (solo stdlib) para evitar imports circulares.
"""
import os

# Secreto de firma de JWT. En producción DEBE venir de la variable de entorno
# JWT_SECRET (validado en main.validate_env, que aborta si es inseguro en prod).
JWT_SECRET = os.getenv("JWT_SECRET", "dev-insecure-change-me")
JWT_ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7
