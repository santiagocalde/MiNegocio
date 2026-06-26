import { Icons, formatPesos } from './shared';

/**
 * Pestaña "Nueva factura / carga manual" de Compras. Presentacional: toda la
 * lógica y el estado siguen en PurchasesModule y llegan por props. Estructura de
 * divs idéntica al original (no se tocó el layout).
 */
export default function NewInvoiceForm({
  suppliers,
  selectedSupplier,
  setSelectedSupplier,
  invoiceNumber,
  setInvoiceNumber,
  searchInputRef,
  searchQuery,
  setSearchQuery,
  handleProductSearch,
  globalProductsDB,
  showQuickAdd,
  handleQuickAddNew,
  cart,
  handleCartItemUpdate,
  handleRemoveItem,
  cartTotal,
  currentTurnId,
  paidFromRegister,
  setPaidFromRegister,
  handleConfirmPurchase,
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>

      {/* Metadata Factura */}
      <div style={{ display: 'flex', gap: '24px', background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>PROVEEDOR</label>
          <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', outline: 'none', fontSize: '0.9rem' }}>
            <option value="">Selecciona un proveedor de la lista...</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>N° DE FACTURA / REMITO</label>
          <input type="text" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Ej: 0001-00002451" style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px', borderRadius: '8px', outline: 'none', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }} />
        </div>
      </div>

      {/* Buscador & Tabla */}
      <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)' }}>
          <form onSubmit={handleProductSearch} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}><Icons.Search /></span>
              <input ref={searchInputRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Escanear código de barras o buscar producto para agregar a la factura..." style={{ width: '100%', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px 16px 12px 42px', borderRadius: '8px', outline: 'none', fontSize: '0.95rem' }} />

              {(searchQuery.trim().length > 0 && globalProductsDB) || showQuickAdd ? (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 100, marginTop: '8px', boxShadow: '0 4px 12px rgba(30,58,95,0.5)' }}>
                  {!showQuickAdd && globalProductsDB && globalProductsDB.filter(p => String(p.code || '').toUpperCase().startsWith(searchQuery.toUpperCase()) || p.name.toLowerCase().startsWith(searchQuery.toLowerCase())).slice(0, 5).map((p) => (
                    <button key={p.id} type="button" onClick={() => { setSearchQuery(p.code); setTimeout(() => handleProductSearch(), 50); }} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }} onFocus={e => e.target.style.background = 'var(--bg-hover)'} onBlur={e => e.target.style.background = 'transparent'} onMouseEnter={e => e.target.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.target.style.background = 'transparent'}>
                      <span style={{ fontWeight: 600 }}>{p.name}</span><span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{p.code}</span>
                    </button>
                  ))}
                  {showQuickAdd && (
                    <div style={{ padding: '16px' }}>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '12px' }}>No se encontró "{searchQuery}". ¿Crear nuevo producto?</div>
                      <button type="button" onClick={handleQuickAddNew} style={{ width: '100%', padding: '12px', background: 'var(--gradient-primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                        Agregar "{searchQuery}"
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <button type="submit" style={{ background: 'var(--gradient-primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '0 24px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}>Agregar</button>
          </form>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-main)', zIndex: 1 }}>
              <tr style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '16px 24px' }}>Producto</th>
                <th style={{ padding: '16px 24px', textAlign: 'center', width: '120px' }}>Costo Unit.</th>
                <th style={{ padding: '16px 24px', textAlign: 'center', width: '120px' }}>Cantidad</th>
                <th style={{ padding: '16px 24px', textAlign: 'right', width: '150px' }}>Subtotal</th>
                <th style={{ padding: '16px 24px', textAlign: 'center', width: '80px' }}></th>
              </tr>
            </thead>
            <tbody>
              {cart.map(item => (
                <tr key={item.product_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.9rem' }}>{item.product_name}</td>
                  <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                     <input type="number" step="0.01" min="0" value={item.unit_cost} onChange={e => handleCartItemUpdate(item.product_id, 'unit_cost', e.target.value)} style={{ width: '80px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: '6px', textAlign: 'center', fontFamily: 'var(--font-mono)', outline: 'none' }} />
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                     <input type="number" min="1" value={item.quantity} onChange={e => handleCartItemUpdate(item.product_id, 'quantity', e.target.value)} style={{ width: '60px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px', borderRadius: '6px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, outline: 'none' }} />
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                     ${(item.quantity * item.unit_cost).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                  </td>
                  <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                     <button onClick={() => handleRemoveItem(item.product_id)} style={{ background: 'transparent', color: 'var(--accent-danger)', border: 'none', cursor: 'pointer', padding: '4px' }}><Icons.X /></button>
                  </td>
                </tr>
              ))}
              {cart.length === 0 && (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)' }}>Aún no hay productos. Buscá arriba o escaneá la factura con IA.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {cart.length > 0 && (
          <div style={{ padding: '24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)' }}>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Total Factura (Costo)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                {formatPesos(cartTotal)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
              {currentTurnId && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={paidFromRegister}
                    onChange={e => setPaidFromRegister(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  Restar de caja registradora (Generar Egreso)
                </label>
              )}
              <button onClick={handleConfirmPurchase} style={{ background: 'var(--gradient-primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '16px 32px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Registrar Compra y Actualizar Stock
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
