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
              <input type="text" placeholder="Buscar factura..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 16px 10px 40px', borderRadius: '8px', outline: 'none', fontSize: '0.95rem', width: '250px' }} />
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '8px' }}>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            ) : purchases.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '60px', minHeight: '300px' }}>
                <EmptyState icon="Truck" title={searchTerm.trim() ? 'Sin resultados' : 'Sin compras'}
                  description={searchTerm.trim() ? 'No hay compras que coincidan con la búsqueda.' : 'Todavía no registraste ninguna compra. Cargá tu primera factura manualmente o escaneala con IA.'}
                  actionLabel="+ Carga Manual" actionOnClick={onNewInvoice} />
              </div>
            ) : (
                purchases.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', padding: '16px 24px', borderRadius: '12px', border: '1px solid var(--border-color)', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseEnter={e=>e.currentTarget.style.transform='translateX(4px)'} onMouseLeave={e=>e.currentTarget.style.transform='none'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flex: 1 }}>
                      <div style={{ width: '48px', height: '48px', background: 'rgba(20,187,166, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                        <Icons.Box />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '4px' }}>{p.supplier_name || 'Proveedor General'}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', gap: '12px' }}>
                          <span>{p.created_at ? new Date(p.created_at).toLocaleDateString('es-AR') : '---'}</span>
                          <span>•</span>
                          <span>Factura: {p.invoice_number || 'S/N'}</span>
                        </div>
                      </div>
                      <div style={{ width: '150px' }}>
                        <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-success)', padding: '4px 12px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                          Completado
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                      <div style={{ fontWeight: 800, fontSize: '1.25rem', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                        {formatPesos(p.total_cost)}
                      </div>
                      <button onClick={() => onViewDetail(p)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px' }} title="Ver Detalle">
                        <Icons.Search />
                      </button>
                    </div>
                  </div>
                ))
              )}
          </div>
        </div>
      </div>
  );
}
