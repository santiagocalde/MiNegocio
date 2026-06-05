import React from 'react';

/*
  TicketPrint — Ticket térmico estilo Coto/supermercado (80mm)
  Se muestra oculto en la pantalla y aparece al imprimir (Ctrl+P / window.print())
  El ancho real de la ticketera es ~42 chars en fuente monospace 12px.
*/

const LINE = '─'.repeat(42);
const DLINE = '═'.repeat(42);

function center(text, width = 42) {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(pad) + text;
}

function formatRow(name, qty, price, total, width = 42) {
  // "2x Coca Cola 500ml         $2.400"
  const qtyStr = `${qty}x `;
  const totalStr = `$${total.toLocaleString('es-AR')}`;
  const maxName = width - qtyStr.length - totalStr.length - 1;
  const truncName = name.length > maxName ? name.slice(0, maxName - 1) + '…' : name.padEnd(maxName);
  return qtyStr + truncName + ' ' + totalStr;
}

function rAlign(label, value, width = 42) {
  const v = `$${typeof value === 'number' ? value.toLocaleString('es-AR') : value}`;
  const pad = Math.max(1, width - label.length - v.length);
  return label + ' '.repeat(pad) + v;
}

export default function TicketPrint({ cart, total, payment, change, operator, ticketNumber, config, isClosingShift, shiftData }) {
  const ivaRate = parseFloat(config?.iva_rate) || 21;
  const ivaMultiplier = 1 + ivaRate / 100;
  const subtotal = total / ivaMultiplier;
  const iva = total - subtotal;
  const now = new Date();
  const fecha = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hora = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  const nombre = config?.nombre || 'KIOSCO';
  const subtitulo = config?.subtitulo || '';
  const direccion = config?.direccion || '';
  const telefono = config?.telefono || '';
  const cuit = config?.cuit || '';
  const condicion = config?.condicion_iva || 'Monotributista';
  const mensaje = config?.mensaje_ticket || '¡Gracias por su compra!';
  const numeroCaja = config?.numero_caja || 'CAJA 1';

  return (
    <div className="ticket-print-area">
      {!isClosingShift ? (
        /* ═══════════════════════════════ TICKET DE VENTA ═══════════════════════════════ */
        <pre className="ticket-body">
{DLINE}
{center(nombre.toUpperCase())}
{subtitulo ? center(subtitulo) : ''}
{direccion ? center(direccion) : ''}
{telefono ? center(`Tel: ${telefono}`) : ''}
{DLINE}
{`CUIT: ${cuit}`}
{`Cond. IVA: ${condicion}`}
{LINE}
{`CAJERO: ${operator || 'Sistema'}`}
{`${numeroCaja}   TICKET: #${String(ticketNumber || 1).padStart(5, '0')}`}
{`FECHA: ${fecha}   HORA: ${hora}`}
{LINE}
{'CANT  DESCRIPCIÓN                  PRECIO'}
{LINE}
{(cart || []).map(item =>
  formatRow(item.name, item.qty, item.price, item.price * item.qty)
).join('\n')}
{LINE}
{rAlign('SUBTOTAL:', subtotal.toFixed(2))}
{rAlign(`IVA (${ivaRate}%):`, iva.toFixed(2))}
{'Régimen de Transparencia Fiscal'}
{LINE}
{rAlign('*** TOTAL:', total)}
{LINE}
{rAlign('EFECTIVO:', payment)}
{rAlign('VUELTO:', change >= 0 ? change : 0)}
{LINE}
{center(mensaje)}
{center('¡Vuelva pronto!')}
{DLINE}
{center(`NovaStock v1.0`)}
        </pre>
      ) : (
        /* ═══════════════════════════════ REPORTE DE CIERRE ═══════════════════════════════ */
        <pre className="ticket-body">
{DLINE}
{center('** CIERRE DE TURNO **')}
{center(nombre.toUpperCase())}
{LINE}
{`OPERADOR: ${shiftData?.operator || operator}`}
{`FECHA:    ${fecha}   HORA: ${hora}`}
{`APERTURA: ${shiftData?.opened_at ? new Date(shiftData.opened_at).toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit'}) : '--:--'}`}
{LINE}
{'RESUMEN DE VENTAS'}
{LINE}
{rAlign('Total tickets:', shiftData?.total_tickets || 0, 42).replace('$', ' ')}
{rAlign('Ventas efectivo:', shiftData?.total_efectivo || 0)}
{shiftData?.total_fiado > 0 ? rAlign('Ventas fiado:', shiftData.total_fiado) : ''}
{rAlign('TOTAL SISTEMA:', (shiftData?.total_efectivo || 0) + (shiftData?.total_fiado || 0))}
{LINE}
{'TOP PRODUCTOS DEL TURNO'}
{LINE}
{(shiftData?.top_products || []).slice(0, 5).map((p, i) =>
  `${i + 1}. ${p.product_name.slice(0, 25).padEnd(25)} x${p.qty}`
).join('\n')}
{LINE}
{'BALANCE DE CAJA'}
{LINE}
{rAlign('Sistema dice:', shiftData?.sales_total || 0)}
{rAlign('Efectivo contado:', shiftData?.counted_cash || 0)}
{LINE}
{(() => {
  const diff = (shiftData?.counted_cash || 0) - (shiftData?.sales_total || 0);
  if (diff === 0) return center('✓ CAJA PERFECTA');
  if (diff > 0) return center(`SOBRA $${Math.abs(diff).toLocaleString('es-AR')}`);
  return center(`*** FALTA $${Math.abs(diff).toLocaleString('es-AR')} ***`);
})()}
{DLINE}
{center('Firma del operador:')}
{''}
{''}
{center('_____________________')}
{center(shiftData?.operator || operator)}
{DLINE}
        </pre>
      )}
    </div>
  );
}
