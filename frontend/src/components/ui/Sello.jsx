/**
 * Sello — Timbre de estado en comprobantes imprimibles.
 * Inspirado en los sellos físicos de "PAGADO", "CUENTA CORRIENTE", etc.
 *
 * Props:
 *   text    — texto del sello (ej: "PAGADO", "CUENTA CORRIENTE")
 *   variant — 'pagado' | 'pendiente' | 'cc' | 'entrega' | 'retiro'
 *   size    — 'sm' | 'md' (default 'md')
 */
export default function Sello({ text, variant = 'pagado', size = 'md' }) {
  const colors = {
    pagado:    { border: '#16a34a', color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
    pendiente: { border: '#d97706', color: '#d97706', bg: 'rgba(217,119,6,0.08)' },
    cc:        { border: '#2563eb', color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
    entrega:   { border: '#D97706', color: '#92400E', bg: 'rgba(217,119,6,0.10)' },
    retiro:    { border: '#D97706', color: '#92400E', bg: 'rgba(217,119,6,0.10)' },
  };
  const c = colors[variant] || colors.pagado;
  const fontSize = size === 'sm' ? '0.68rem' : '0.9rem';
  const padding  = size === 'sm' ? '4px 10px'  : '6px 18px';

  return (
    <div style={{
      display: 'inline-block',
      border: `2.5px solid ${c.border}`,
      borderRadius: 4,
      padding,
      color: c.color,
      background: c.bg,
      fontSize,
      fontWeight: 900,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      transform: 'rotate(-6deg)',
      fontFamily: 'var(--lp-font-display, system-ui, sans-serif)',
      lineHeight: 1.3,
      userSelect: 'none',
      pointerEvents: 'none',
      textAlign: 'center',
      boxShadow: `inset 0 0 0 1px ${c.border}22`,
    }}>
      {text}
    </div>
  );
}

/**
 * SelloComprobante — helper que elige texto y variante según el método de pago
 * o el tipo de entrega de un acopio/remito.
 *
 *   paymentMethod: 'efectivo'|'tarjeta'|'transferencia'|'mp'|'fiado'|'cc'|'entrega'|'retiro'
 *   deliveryType:  'retiro'|'entrega' (para acopios y remitos)
 *   status:        'paid'|'pending' (para presupuestos)
 */
export function SelloComprobante({ paymentMethod, deliveryType, status }) {
  if (deliveryType === 'entrega') return <Sello text="Entrega a domicilio" variant="entrega" />;
  if (deliveryType === 'retiro')  return <Sello text="Retira en planta"    variant="retiro" />;

  if (status === 'pending') return <Sello text="Pendiente" variant="pendiente" />;

  const pm = (paymentMethod || '').toLowerCase();
  if (pm === 'fiado' || pm === 'cc' || pm === 'cuenta corriente') {
    return <Sello text="Cuenta corriente" variant="cc" />;
  }
  if (pm === 'entrega' || pm === 'abono en entrega') {
    return <Sello text="Abona al recibir" variant="entrega" />;
  }
  // efectivo, tarjeta, transferencia, mp → pagado
  return <Sello text="Pagado" variant="pagado" />;
}
