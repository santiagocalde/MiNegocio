import { useState, useEffect, useCallback } from 'react';

// Caché en memoria a nivel módulo: sobrevive a desmontajes de componentes
// (cambiar de pantalla y volver) y se limpia al recargar la página.
const _cache = new Map();

/**
 * Invalida la caché. Sin argumento limpia todo; con `key` limpia esa entrada.
 * Útil tras un logout o cambio de sucursal.
 */
export function invalidateStaleData(key) {
  if (key) _cache.delete(key);
  else _cache.clear();
}

/**
 * Stale-While-Revalidate: devuelve AL INSTANTE lo último cacheado para `key`
 * y revalida en segundo plano. Hace que volver a una pantalla se sienta
 * inmediato aunque el servidor esté en otra región (cada fetch es un viaje de
 * red caro). El dato igual se refresca siempre, así que a lo sumo se ve un
 * instante de dato viejo que se auto-corrige.
 *
 * @param {string}   key      clave de caché, p.ej. '/customers'
 * @param {Function} fetcher  async () => data  (devuelve los datos ya parseados; debe lanzar en error)
 * @returns {{data:any, loading:boolean, error:boolean, refresh:Function}}
 *
 * Tras una mutación (crear/editar/borrar) llamá a `refresh()` para revalidar
 * y actualizar la caché.
 */
export function useStaleData(key, fetcher) {
  const [data, setData] = useState(() => _cache.get(key));
  const [loading, setLoading] = useState(() => !_cache.has(key));
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!_cache.has(key)) setLoading(true);
    try {
      const fresh = await fetcher();
      _cache.set(key, fresh);
      setData(fresh);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
    // fetcher se omite a propósito: suele ser una arrow inline que cambia en
    // cada render. La identidad estable es `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (_cache.has(key)) {       // mostrar caché al instante
      setData(_cache.get(key));
      setLoading(false);
    }
    refresh();                   // y revalidar siempre en segundo plano
  }, [key, refresh]);

  return { data, loading, error, refresh };
}
