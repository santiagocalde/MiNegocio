// Atribución de origen (first-touch): registra de dónde vino la persona la
// PRIMERA vez que cae en el sitio, y lo conserva hasta que se registra.
// Liviano y sin dependencias — no rastrea nada sensible, solo el canal.

const KEY = 'minegocio_source';

function _firstHost(referrer) {
  try {
    if (!referrer) return '';
    const h = new URL(referrer).hostname.replace(/^www\./, '');
    // No atribuir el tráfico interno (mismo dominio) como "referido"
    if (h && h !== window.location.hostname) return h;
  } catch { /* referrer inválido o cross-origin: ignorar */ }
  return '';
}

/** Captura el origen una sola vez (no pisa el valor ya guardado). */
export function captureSource() {
  try {
    if (localStorage.getItem(KEY)) return; // first-touch: no sobreescribir
    const p = new URLSearchParams(window.location.search);
    const explicit = p.get('utm_source') || p.get('ref') || p.get('source');
    let src = (explicit || '').trim().slice(0, 120);
    if (!src && (p.get('gclid') || p.get('gad_source'))) src = 'google_ads';
    if (!src && p.get('fbclid')) src = 'meta_ads';
    if (!src) src = _firstHost(document.referrer) || 'directo';
    localStorage.setItem(KEY, src);
  } catch { /* localStorage no disponible (modo privado): ignorar */ }
}

/** Devuelve el origen guardado (o '' si no hay). */
export function getSource() {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
}
