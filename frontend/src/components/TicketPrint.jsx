import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

/*
  TicketPrint ??? Ticket termico 80mm
  Estructurado con HTML/CSS, no monospace hackeado.
*/

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('es-AR') : n);
const F = (n) => '$' + (typeof n === 'number' ? n.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }) : n);

function ItemRow({ item }) {
  const lineTotal = item.price * (item.qty || 1);
  return (
    <tr className="t-row">
      <td className="t-qty">{item.qty || 1}x</td>
      <td className="t-name">{item.name}</td>
      <td className="t-price">{F(item.price)}</td>
      <td className="t-ltotal">{F(lineTotal)}</td>
    </tr>
  );
}

export default function TicketPrint({ cart, total, payment, change, operator, ticketNumber, config, isClosingShift, shiftData, tipoFactura, afip, paymentMethod }) {
  const ivaRate = parseFloat(config?.iva_rate) ?? 21;
  const ivaMultiplier = 1 + ivaRate / 100;
  const subtotal = total / ivaMultiplier;
  const iva = total - subtotal;
  const now = new Date();
  const fecha = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  const isCorralon = config?.business_type === 'corralon';
  const nombre = config?.nombre || 'KIOSCO';
  const subtitulo = config?.subtitulo || '';
  const direccion = config?.direccion || '';
  const telefono = config?.telefono || '';
  const instagram = config?.instagram || '';
  const cuit = config?.cuit || '';
  const condicion = config?.condicion_iva || 'Monotributista';
  const mensaje = config?.mensaje_ticket || 'Gracias por su compra';
  const numeroCaja = config?.numero_caja || 'CAJA 1';
  const logoUrl = config?.logo_url || '';
  const isFacturaA = tipoFactura === 'A';

  const qrCanvasRef = useRef(null);

  useEffect(() => {
    if (afip?.cae && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, `https://afip.gob.ar/fe/comprobante?cae=${afip.cae}`, {
        width: 140, margin: 2, color: { dark: '#1E3A5F', light: '#fff' }
      });
    }
  }, [afip]);

  const hr = <hr className="t-hr" />;

  if (isClosingShift) {
    const diff = (shiftData?.counted_cash || 0) - (shiftData?.sales_total || 0);
    return (
      <div className="ticket-print-area">
        <div className="t-header">
          <div className="t-title">CIERRE DE TURNO</div>
          <div className="t-subtitle">{nombre.toUpperCase()}</div>
        </div>
        {hr}
        <table className="t-inline"><tbody>
          <tr><td className="t-lef">Operador</td><td className="t-rit">{shiftData?.operator || operator}</td></tr>
          <tr><td className="t-lef">Fecha</td><td className="t-rit">{fecha}  {hora}</td></tr>
          <tr><td className="t-lef">Apertura</td><td className="t-rit">{shiftData?.opened_at ? new Date(shiftData.opened_at).toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit'}) : '--:--'}</td></tr>
        </tbody></table>
        {hr}
        <div className="t-section-title">RESUMEN DE VENTAS</div>
        <table className="t-inline"><tbody>
          <tr><td className="t-lef">Total tickets</td><td className="t-rit">{fmt(shiftData?.total_tickets || 0)}</td></tr>
          <tr><td className="t-lef">Ventas efectivo</td><td className="t-rit">{F(shiftData?.total_efectivo || 0)}</td></tr>
          {shiftData?.total_fiado > 0 && <tr><td className="t-lef">Ventas fiado</td><td className="t-rit">{F(shiftData.total_fiado)}</td></tr>}
          <tr className="t-total-row"><td className="t-lef">TOTAL SISTEMA</td><td className="t-rit">{F((shiftData?.total_efectivo || 0) + (shiftData?.total_fiado || 0))}</td></tr>
        </tbody></table>
        {hr}
        <div className="t-section-title">TOP PRODUCTOS</div>
        <table className="t-inline"><tbody>
          {(shiftData?.top_products || []).slice(0, 5).map((p, i) => (
            <tr key={i}><td className="t-lef">{i + 1}. {p.product_name.slice(0, 28)}</td><td className="t-rit">x{p.qty}</td></tr>
          ))}
        </tbody></table>
        {hr}
        <div className="t-section-title">BALANCE DE CAJA</div>
        <table className="t-inline"><tbody>
          <tr><td className="t-lef">Sistema dice</td><td className="t-rit">{F(shiftData?.sales_total || 0)}</td></tr>
          <tr><td className="t-lef">Efectivo contado</td><td className="t-rit">{F(shiftData?.counted_cash || 0)}</td></tr>
        </tbody></table>
        {hr}
        <div className="t-center">
          {diff === 0 ? 'CAJA PERFECTA' : diff > 0 ? `SOBRA ${F(Math.abs(diff))}` : `FALTA ${F(Math.abs(diff))}`}
        </div>
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <div style={{ marginBottom: 24 }}>Firma del operador</div>
          <div>_____________________</div>
          <div style={{ marginTop: 4, fontWeight: 700 }}>{shiftData?.operator || operator}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ticket-print-area">
      {logoUrl && <div style={{ textAlign: 'center', paddingBottom: 6 }}><img src={logoUrl} style={{ maxHeight: 44, maxWidth: 140, objectFit: 'contain' }} alt="logo" /></div>}
      <div className="t-header">
        <div className="t-title">{nombre.toUpperCase()}</div>
        {subtitulo && <div className="t-subtitle">{subtitulo}</div>}
        {direccion && <div className="t-subtitle">{direccion}</div>}
        {telefono && <div className="t-subtitle">Tel: {telefono}</div>}
        {instagram && <div className="t-subtitle">IG: {instagram}</div>}
      </div>
      {hr}
      {(cuit || condicion) ? <><table className="t-inline"><tbody>
        <tr><td className="t-lef">CUIT</td><td className="t-rit">{cuit}</td></tr>
        <tr><td className="t-lef">Cond. IVA</td><td className="t-rit">{condicion}</td></tr>
      </tbody></table>{hr}</> : null}
      <table className="t-inline"><tbody>
        <tr><td className="t-lef">{numeroCaja}</td><td className="t-rit t-rit-pad">Ticket #{String(ticketNumber || 1).padStart(5, '0')}</td></tr>
        <tr><td className="t-lef">{fecha}  {hora}</td><td className="t-rit t-rit-pad">Cajero: {operator || 'Sistema'}</td></tr>
      </tbody></table>
      {hr}
      <table className="t-items">
        <thead>
          <tr className="t-head-row">
            <th className="t-qty">Cant</th>
            <th className="t-name">Descripcion</th>
            <th className="t-price">P.Unit</th>
            <th className="t-ltotal">Total</th>
          </tr>
        </thead>
        <tbody>
          {(cart || []).map((item, i) => <ItemRow key={i} item={item} />)}
        </tbody>
      </table>
      {hr}
      {isFacturaA ? (
        <table className="t-inline t-summary"><tbody>
          <tr><td className="t-lef">SUBTOTAL NETO</td><td className="t-rit">{F(subtotal.toFixed(2))}</td></tr>
          <tr><td className="t-lef">IVA {ivaRate}%</td><td className="t-rit">{F(iva.toFixed(2))}</td></tr>
          <tr><td className="t-lef"></td><td className="t-rit"></td></tr>
        </tbody></table>
      ) : (
        <div className="t-center" style={{ fontSize: '0.7em', marginBottom: 4 }}>El precio incluye IVA</div>
      )}
      <table className="t-inline t-summary"><tbody>
        <tr className="t-total-row"><td className="t-lef">TOTAL</td><td className="t-rit t-rit-pad" style={{ fontSize: '1.3em' }}>{F(total)}</td></tr>
      </tbody></table>
      {hr}
      <table className="t-inline"><tbody>
        <tr><td className="t-lef">{(paymentMethod || 'EFECTIVO').toUpperCase()}</td><td className="t-rit t-rit-pad">{F(payment)}</td></tr>
        <tr><td className="t-lef">VUELTO</td><td className="t-rit t-rit-pad">{F(change >= 0 ? change : 0)}</td></tr>
      </tbody></table>
      {isCorralon && <div className="t-center" style={{ fontWeight: 800, fontSize: '1.15em', letterSpacing: 3, marginTop: 6 }}>P A G A D O</div>}
      {hr}
      <div className="t-center t-mensaje">{mensaje}</div>
      <div className="t-center" style={{ marginBottom: 8, fontSize: '0.85em' }}>Vuelva pronto!</div>
      {afip?.cae ? (
        <>
          {hr}
          <div className="t-center" style={{ fontWeight: 700, marginBottom: 4 }}>DATOS AFIP</div>
          <table className="t-inline"><tbody>
            <tr><td className="t-lef">CAE</td><td className="t-rit" style={{ fontSize: '0.75em' }}>{afip.cae}</td></tr>
            <tr><td className="t-lef">Vto CAE</td><td className="t-rit">{afip.vto}</td></tr>
            <tr><td className="t-lef">Comprobante</td><td className="t-rit">{tipoFactura} Nro {afip.cbte}</td></tr>
          </tbody></table>
          <div style={{ textAlign: 'center', margin: '8px 0' }}>
            <canvas ref={qrCanvasRef} style={{ width: 128, height: 128 }} />
          </div>
        </>
      ) : null}
      <div className="t-center" style={{ marginTop: 10, fontSize: '0.65em', color: '#999' }}>MiNegocio v1.0</div>
    </div>
  );
}
