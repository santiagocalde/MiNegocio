/**
 * Tracking liviano del funnel de adquisición (visita landing → registro).
 * Envía eventos a POST /api/track (endpoint público, sin auth).
 * Es best-effort: si falla no rompe nada ni bloquea la UI.
 */
import { API_BASE } from '../config';

// ID de sesión efímero para agrupar eventos de una misma visita.
function sessionId() {
  try {
    let id = sessionStorage.getItem('mn_sid');
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('mn_sid', id);
    }
    return id;
  } catch {
    return '';
  }
}

function utmParams() {
  try {
    const q = new URLSearchParams(window.location.search);
    return {
      utm_source: q.get('utm_source') || document.referrer ? (q.get('utm_source') || 'referral') : '',
      utm_medium: q.get('utm_medium') || '',
      utm_campaign: q.get('utm_campaign') || '',
    };
  } catch {
    return {};
  }
}

export function track(event) {
  try {
    const body = JSON.stringify({
      event,
      path: window.location.pathname,
      session_id: sessionId(),
      ...utmParams(),
    });
    // sendBeacon sobrevive a la navegación; fetch como fallback.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(`${API_BASE}/track`, new Blob([body], { type: 'application/json' }));
    } else {
      fetch(`${API_BASE}/track`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    /* no-op */
  }
}
