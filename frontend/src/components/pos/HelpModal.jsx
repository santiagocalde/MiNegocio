import React from 'react';

export default function HelpModal({ showHelp, setShowHelp }) {
  if (!showHelp) return null;
  return (
    <div className="modal-overlay" onClick={() => setShowHelp(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto' }}>
        <h2 className="modal-title" style={{ fontSize: '1.8rem' }}>⌨️ Ayuda Rápida</h2>
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '12px', color: 'var(--text-primary)' }}>Atajos de Teclado</h3>
          {[
            { key: 'Enter', label: 'Cobrar — Procesar la venta si estás en la caja' },
            { key: 'Doble Enter', label: 'Procesar Venta — Cobra automáticamente' },
            { key: 'Supr', label: 'Quitar — Elimina el último producto del carrito' },
            { key: 'Esc', label: 'Salir — Cierra modales o limpia la búsqueda' },
          ].map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-main)', borderRadius: '8px', padding: '10px 16px', marginBottom: '8px' }}>
              <span style={{ background: 'var(--accent-primary)', color: 'white', borderRadius: '6px', padding: '4px 12px', fontWeight: 800, fontSize: '1rem', minWidth: '80px', textAlign: 'center' }}>{s.key}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>{s.label}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '12px', color: 'var(--text-primary)' }}>❓ Preguntas Frecuentes</h3>
          {[
            { q: 'No encuentro un producto', a: 'Escribí el nombre o código de barras en el buscador.' },
            { q: 'Me equivoqué de precio', a: 'Antes de cobrar, tocá "Ajustar total" en la pantalla de pago.' },
            { q: 'No anda el lector de códigos', a: 'Escribí el código a mano y presioná Enter.' },
            { q: 'La pantalla se ve mal', a: 'Presioná F11 para pantalla completa.' },
          ].map((faq, i) => (
            <details key={i} style={{ background: 'var(--bg-main)', borderRadius: '8px', padding: '8px 16px', marginBottom: '8px' }}>
              <summary style={{ fontWeight: 700, cursor: 'pointer', color: 'var(--text-primary)' }}>{faq.q}</summary>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px', paddingLeft: '8px', borderLeft: '2px solid var(--accent-primary)' }}>{faq.a}</p>
            </details>
          ))}
        </div>
        <div className="modal-actions" style={{ marginTop: '24px' }}><button className="btn btn-modal-confirm" onClick={() => setShowHelp(false)}>Cerrar (Esc)</button></div>
      </div>
    </div>
  );
}
