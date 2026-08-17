import { SkeletonCard } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { Icons, formatPesos } from './shared';

/**
 * Pestaña "Historial" de Compras. Presentacional: recibe los datos ya filtrados
 * y los callbacks. Extraído de PurchasesModule replicando la MISMA estructura de
 * divs del original (no se tocó el layout).
 */
export default function PurchasesHistory({
  loading,
  purchases,
  searchTerm,
  setSearchTerm,
  onNewInvoice,
  onViewDetail,
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>


      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}><Icons.Search /></span>
              <input type="text" placeholder="Buscar factura..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ background: 'var(--sheet)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 16px 10px 40px', borderRadius: 'var(--radius-sm)', outline: 'none', fontSize: '0.95rem', width: '250px' }} />
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : purchases.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '60px', minHeight: '300px' }}>
              <EmptyState icon="Truck" title={searchTerm.trim() ? 'Sin resultados' : 'Sin compras'}
                description={searchTerm.trim() ? 'No hay compras que coincidan con la búsqueda.' : 'Todavía no registraste ninguna compra. Cargá tu primera factura manualmente o escaneala con IA.'}
                actionLabel="+ Carga Manual" actionOnClick={onNewInvoice} />
            </div>
          ) : (
            <div className="ledger-sheet" style={{ overflow: 'hidden' }}>
              {purchases.map(p => (
                <div key={p.id} className="ledger-row ledger-row--hover" onClick={() => onViewDetail(p)} style={{ flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, flexWrap: 'wrap' }}>
                    <div style={{ width: '42px', height: '42px', background: 'var(--wash-primary)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', flexShrink: 0 }}>
                      <Icons.Box />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem', marginBottom: '3px' }}>{p.supplier_name || 'Sin proveedor'}</div>
                      <div style={{ color: 'var(--text-faint)', fontSize: '0.82rem', display: 'flex', gap: '10px' }}>
                        <span className="ledger-num">{p.created_at ? new Date(p.created_at).toLocaleDateString('es-AR') : '---'}</span>
                        <span>·</span>
                        <span>Factura {p.invoice_number || 'S/N'}</span>
                      </div>
                    </div>
                    <span className="ledger-label" style={{ color: 'var(--accent-success)', background: 'var(--wash-success)', border: '1px solid var(--border-color)', padding: '3px 8px', borderRadius: '3px' }}>
                      Completado
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div className="ledger-num" style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      {formatPesos(p.total_cost)}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); onViewDetail(p); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px' }} title="Ver detalle">
                      <Icons.Search />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
  );
}
