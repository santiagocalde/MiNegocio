/**
 * MpQrFijoCobro — cobro con el QR fijo del mostrador (QR Presencial de MP).
 * Arma una orden con el monto sobre la caja fija, muestra el QR (el mismo que
 * está pegado en el mostrador) y hace poll a nuestro backend. Cuando el pago
 * impacta, muestra "PAGO RECIBIDO" y desbloquea la venta (onPaid).
 *
 * Al desmontarse (venta procesada o cobro cancelado) DESARMA la orden, para que
 * el QR fijo no quede con un monto viejo colgado para el próximo cliente.
 *
 * Solo se usa si el negocio activó la auto-confirmación y tiene la caja creada.
 */
import { useEffect, useRef, useState } from 'react';
import { apiPost, apiGet } from '../../services/apiClient';

export default function MpQrFijoCobro({ total, onPaid, onError, addToast }) {
  const [qrSrc, setQrSrc] = useState('');
  const [status, setStatus] = useState('loading'); // loading | waiting | paid | error
  const intentRef = useRef(null);
  const paidRef = useRef(false);

  // 1) Armar la orden con el monto sobre la caja fija (una sola vez).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await apiPost('/mp/intent', { total, description: 'Venta' });
        const d = await r.json().catch(() => ({}));
        if (!alive) return;
        if (!r.ok) {
          // La caja QR automática no está configurada (o falló el armado). En vez
          // de bloquear la venta con una alerta, avisamos al padre para caer al
          // QR manual: se cobra igual mostrando el QR del celular. Configurar la
          // caja automática es OPCIONAL, nunca una traba para cobrar.
          setStatus('error');
          onError?.(d.detail);
          return;
        }
        intentRef.current = d.intent_id;
        if (d.qr_pos_url) setQrSrc(d.qr_pos_url);
        setStatus('waiting');
      } catch {
        if (alive) { setStatus('error'); onError?.(); }
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2) Poll de estado contra NUESTRO backend (verifica el pago real + monto).
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
          onPaid?.(); // desbloquea "Procesar Venta" (no cierra la venta solo)
        }
      } catch { /* reintenta en el proximo tick */ }
    }, 3000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // 3) Al desmontar: desarmar la orden de la caja (venta procesada o cancelada).
  //    Deja el QR fijo libre para el próximo cobro. Fire-and-forget.
  useEffect(() => {
    return () => {
      const id = intentRef.current;
      if (id) { try { apiPost(`/mp/intent/${id}/cancel`, {}); } catch { /* noop */ } }
    };
  }, []);

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
        <div style={{ color: 'var(--accent-danger)', fontWeight: 700, marginBottom: 6 }}>No se pudo armar el cobro</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Revisá la caja QR en Configuración, o cobrá por otro medio.</div>
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>El cliente escanea el QR del mostrador</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>o el que se muestra acá</div>
      {qrSrc
        ? <img src={qrSrc} alt="QR de pago" style={{ width: 200, height: 200, background: '#fff', borderRadius: 8, padding: 6, objectFit: 'contain' }} />
        : <div style={{ height: 200, display: 'grid', placeItems: 'center', color: 'var(--text-secondary)' }}>Armando cobro…</div>}
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
