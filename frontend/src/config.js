/**
 * Configuración central del frontend — única fuente de verdad para URLs.
 *
 * Antes cada archivo repetía `import.meta.env.PROD ? '' : 'http://localhost:8005'`
 * (estaba en 11 lugares). Si cambiaba el puerto de dev había que tocar todos.
 *
 * API_ROOT  → raíz del backend ('' en prod = mismo origen detrás de nginx).
 * API_BASE  → raíz + '/api' (lo que usa apiClient y la mayoría de los fetch).
 */
const DEV_BACKEND = 'http://localhost:8005';

export const API_ROOT = import.meta.env.PROD ? '' : DEV_BACKEND;
export const API_BASE = `${API_ROOT}/api`;
