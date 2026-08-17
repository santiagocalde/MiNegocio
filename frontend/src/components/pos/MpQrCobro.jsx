/**
 * MpQrCobro — cobro con QR de Mercado Pago con auto-confirmación.
 * Genera un QR por venta, hace poll a nuestro backend y cuando el pago impacta
 * muestra "PAGO RECIBIDO" y confirma la venta sola (onPaid).
 * Solo se usa si el negocio activó la auto-confirmación y cargó su token.
 */
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { apiPost, apiGet } from '../../services/apiClient';

export default function MpQrCobro({ total, onPaid, addToast }) {
  const [qrSrc, setQrSrc] = useState('');
  const [status, setStatus] = useState('loading'); // loading | waiting | paid | error
  const intentRef = useRef(null);
  const paidRef = useRef(false);

  // 1) Crear el cobro y generar el QR (una sola vez).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await apiPost('/mp/intent', { total, description: 'Venta' });
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok || !d.init_point) {
          setStatus('error');
          addToast?.(d.detail || 'No se pudo generar el QR de Mercado Pago.', 'error');
          return;
        }
        intentRef.current = d.intent_id;
        const dataUrl = await QRCode.toDataURL(d.init_point, { width: 260, margin: 1 });
        if (!alive) return;
        setQrSrc(dataUrl);
        setStatus('waiting');
      } catch {
        if (alive) setStatus('error');
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Poll de estado contra NUESTRO backend (no MP). Cuando aprueba, confirma.
  useEffect(() => {
    if (status !== 'waiting' || !intentRef.current) return;
    const iv = setInterval(async () => {
      try {
        const r = await apiGet(`/mp/intent/${intentRef.current}`);
        if (!r.ok) return;
        const d = await r.json();
        if (d.status === 'approved' && !paidRef.current) {
          paidRef.current = true;
          clearInterval(iv);
          setStatus('paid');
          onPaid?.(); // desbloquea el botón "Procesar Venta" (no cierra la venta solo)
        }
      } catch { /* reintenta en el proximo tick */ }
    }, 3000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const box = { background: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(20,187,166,0.3)', textAlign: 'center' };

  if (status === 'paid') {
    return (
      <div style={{ ...box, borderColor: 'var(--accent-success)', background: 'rgba(16,185,129,0.1)' }}>
        <div style={{ fontSize: '3rem', lineHeight: 1 }}>✓</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-success)', marginTop: 8 }}>¡PAGO RECIBIDO!</div>
        <div style={{ fontSize: '1.1rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>${Number(total).toLocaleString('es-AR')}</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 8 }}>Ya podés presionar "Procesar Venta".</div>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div style={{ ...box, borderColor: 'var(--accent-danger)' }}>
        <div style={{ color: 'var(--accent-danger)', fontWeight: 700, marginBottom: 6 }}>No se pudo generar el QR</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Revisá el Access Token de Mercado Pago en Configuración, o cobrá por otro medio.</div>
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>Escaneá para pagar</div>
      {qrSrc
        ? <img src={qrSrc} alt="QR de pago" style={{ width: 220, height: 220 }} />
        : <div style={{ height: 220, display: 'grid', placeItems: 'center', color: 'var(--text-secondary)' }}>Generando QR…</div>}
      <div style={{ marginTop: 10, padding: '10px', background: 'rgba(20,187,166,0.06)', borderRadius: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        Monto: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>${Number(total).toLocaleString('es-AR')}</strong>
      </div>
      <div style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span className="mp-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-primary)', display: 'inline-block' }} />
        Esperando el pago… se confirma solo
      </div>
    </div>
  );
}
