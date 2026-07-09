import { useState, useEffect } from 'react';
import { usePanelContext } from '../context/PanelContext';
import { apiGet, apiPost } from '../services/apiClient';
import FeatureGate from '../components/ui/FeatureGate';

const PLAN_WEIGHT = { trial: 1, simple: 1, pro: 2, ia: 3 };

const Icons = {
  Brain: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>,
  TrendingUp: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
  AlertTriangle: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  CloudRain: () => <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16h16M4 16a4 4 0 01-4-4 4 4 0 014-4 4 4 0 017.2-2.1A6 6 0 0120 12a4 4 0 010 8m-4 4v-4m-4 4v-4m-4 4v-4" /></svg>
};

function IaCard({ titulo, subtitulo, icon, loading, texto, vacio }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(20,187,166,0.05))', border: '1px solid rgba(165,180,252,0.25)', borderRadius: '16px', padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#c4b5fd', fontWeight: 800, fontSize: '1.05rem', marginBottom: '4px' }}>
        {icon} {titulo}
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 14px' }}>{subtitulo}</p>
      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>Analizando con IA…</div>
      ) : texto ? (
        <div style={{ color: 'var(--text-primary)', fontSize: '0.96rem', lineHeight: 1.65, whiteSpace: 'pre-line' }}>{texto}</div>
      ) : (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>{vacio}</div>
      )}
    </div>
  );
}

const PRIO_COLOR = { urgente: 'var(--accent-danger)', alta: 'var(--accent-warning)', media: '#a5b4fc' };

function PreciosIaCard({ loading, texto, sugerencias, onApply, addToast }) {
  const [aplicados, setAplicados] = useState({});   // {product_id: 'ok' | 'loading'}

  const aplicar = async (s) => {
    setAplicados(prev => ({ ...prev, [s.product_id]: 'loading' }));
    const ok = await onApply(s);
    setAplicados(prev => ({ ...prev, [s.product_id]: ok ? 'ok' : undefined }));
    addToast?.(ok ? `${s.name}: precio actualizado a $${s.price_sugerido.toLocaleString('es-AR')}` : 'No se pudo aplicar el precio', ok ? 'success' : 'error');
  };

  return (
    <div style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(20,187,166,0.05))', border: '1px solid rgba(165,180,252,0.25)', borderRadius: '16px', padding: '20px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#c4b5fd', fontWeight: 800, fontSize: '1.05rem', marginBottom: '4px' }}>
        <Icons.Brain /> Asesor de precios
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 14px' }}>Qué subir y cuánto exactamente, según costo y rotación. Aplicás con un click.</p>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>Analizando con IA…</div>
      ) : (
        <>
          {texto && <div style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: 14 }}>{texto}</div>}
          {sugerencias.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>Tus precios están sanos: no hay nada para ajustar.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sugerencias.map(s => {
                const estado = aplicados[s.product_id];
                return (
                  <div key={s.product_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--bg-main)', borderRadius: 10, padding: '12px 14px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: PRIO_COLOR[s.prioridad] || '#a5b4fc', flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>
                        <span style={{ color: 'var(--text-secondary)', textDecoration: 'line-through' }}>${s.price_actual.toLocaleString('es-AR')}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>→</span>
                        <span style={{ color: 'var(--accent-success)', fontWeight: 800 }}>${s.price_sugerido.toLocaleString('es-AR')}</span>
                        <span style={{ color: PRIO_COLOR[s.prioridad] || '#a5b4fc', fontSize: '0.8rem', fontWeight: 700 }}>(+{s.delta_pct}%)</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: 2 }}>{s.motivo} · margen {s.margen_actual}% → {s.margen_nuevo}%</div>
                    </div>
                    <button
                      onClick={() => aplicar(s)}
                      disabled={estado === 'ok' || estado === 'loading'}
                      style={{ flexShrink: 0, padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: '0.85rem', cursor: estado ? 'default' : 'pointer', background: estado === 'ok' ? 'rgba(20,187,166,0.15)' : 'var(--gradient-primary)', color: estado === 'ok' ? 'var(--accent-success)' : 'white' }}
                    >
                      {estado === 'ok' ? '✓ Aplicado' : estado === 'loading' ? '…' : 'Aplicar'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function RecomendacionesModule() {
  const { addToast, backend, currentPlan } = usePanelContext();
  const isLocked = PLAN_WEIGHT[currentPlan] < PLAN_WEIGHT['ia'];
  const [suggestions, setSuggestions] = useState([]);
  const [deadStock, setDeadStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [iaPrecios, setIaPrecios] = useState({ texto: '', sugerencias: [], loading: true });
  const [iaRepo, setIaRepo] = useState({ texto: '', loading: true });

  useEffect(() => {
    if (isLocked) {
      setIaPrecios({ texto: '', sugerencias: [], loading: false });
      setIaRepo({ texto: '', loading: false });
      setSuggestions([
        { id: 1, product_name: 'Alfajor Fantoche', cost_price: 350, price: 400, suggested_price: 600, margin_pct: 12 },
        { id: 2, product_name: 'Cerveza Quilmes 1L', cost_price: 1200, price: 1400, suggested_price: 1800, margin_pct: 14 },
        { id: 3, product_name: 'Galletitas Oreo', cost_price: 500, price: 550, suggested_price: 750, margin_pct: 9 },
      ]);
      setDeadStock([
        { id: 4, name: 'Vino Tinto Generico', stock: 12, price: 2500 },
        { id: 5, name: 'Pilas AAA (Pack x4)', stock: 8, price: 1800 },
      ]);
      setLoading(false);
      return;
    }

    apiGet('/products/price-suggestions?threshold_pct=15')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.suggestions || data?.products || []);
        setSuggestions(Array.isArray(list) ? list : []);
      })
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));

    apiGet('/products/dead-stock?days=30')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.dead_stock || []);
        setDeadStock(Array.isArray(list) ? list.slice(0, 5) : []);
      })
      .catch(() => setDeadStock([]));

    apiGet('/ai/precios')
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(d => setIaPrecios({ texto: d.texto || '', sugerencias: d.sugerencias || [], loading: false }))
      .catch(() => setIaPrecios({ texto: '', sugerencias: [], loading: false }));

    apiGet('/ai/reposicion')
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(d => setIaRepo({ texto: d.texto || '', loading: false }))
      .catch(() => setIaRepo({ texto: '', loading: false }));
  }, []);

  const handleApplyOne = async (s) => {
    try {
      const { apiPatch } = await import('../services/apiClient');
      const res = await apiPatch(`/products/${s.product_id}/price`, { price: s.price_sugerido });
      return res.ok;
    } catch {
      return false;
    }
  };

  const handleApplyPrices = async () => {
    try {
      const prices = suggestions
        .filter(s => s.suggested_price || s.target_price)
        .map(s => ({
          id: s.id || s.product_id,
          price: s.suggested_price || s.target_price,
        }));
      if (prices.length === 0) {
        if (addToast) addToast('No hay precios sugeridos para aplicar.', 'info');
        return;
      }
      const { apiPatch } = await import('../services/apiClient');
      let applied = 0;
      for (const p of prices) {
        const res = await apiPatch(`/products/${p.id}/price`, { price: p.price });
        if (res.ok) applied++;
      }
      if (addToast) addToast(`${applied} precios actualizados correctamente.`, 'success');
      setSuggestions(prev => prev.filter(s => !prices.find(p => p.id === (s.id || s.product_id))));
    } catch {
      if (addToast) addToast('No se pudieron aplicar los precios sugeridos. Reintentá o revisá tu conexión.', 'error');
    }
  };

  const handleCreatePromo = async () => {
    if (deadStock.length === 0) {
      if (addToast) addToast('No hay productos sin rotacion para armar una promo.', 'info');
      return;
    }
    try {
      const { apiPost } = await import('../services/apiClient');
      const promoName = deadStock.length === 1
        ? `2x1 ${deadStock[0].name || 'Producto'}`
        : `Combo Liquidacion (${deadStock.length} productos)`;
      const res = await apiPost('/promotions', {
        name: promoName,
        description: 'Promocion automatica para liberar stock sin rotacion',
        type: 'combo',
        conditions: deadStock.map(p => ({ product_id: p.id || p.product_id, min_qty: 2 })),
        discount_percent: 50,
        combo_price: 0,
        is_active: true,
      });
      if (res.ok) {
        if (addToast) addToast('Promocion creada automaticamente.', 'success');
        setDeadStock([]);
      } else {
        const err = await res.json().catch(() => ({}));
        if (addToast) addToast(err.detail || 'No se pudo crear la promoción. Reintentá o revisá tu conexión.', 'error');
      }
    } catch {
      if (addToast) addToast('No se pudo conectar con el servidor. Revisá tu conexión a internet.', 'error');
    }
  };

  return (
    <FeatureGate isLocked={isLocked} requiredPlan="IA">
      <div style={{ padding: '12px 20px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Recomendaciones IA</h2>
      </div>

      {/* ANÁLISIS EN LENGUAJE NATURAL (IA) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <PreciosIaCard
          loading={iaPrecios.loading}
          texto={iaPrecios.texto}
          sugerencias={iaPrecios.sugerencias}
          addToast={addToast}
          onApply={handleApplyOne}
        />
        <IaCard
          titulo="Reposición inteligente"
          subtitulo="Qué comprar antes de quedarte sin, según el ritmo de venta."
          icon={<Icons.CloudRain />}
          loading={iaRepo.loading}
          texto={iaRepo.texto}
          vacio="Nada urgente por reponer en los próximos días."
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)' }}>Cargando sugerencias...</div>
      ) : suggestions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-secondary)' }}>
          No hay sugerencias de ajuste de precios en este momento. Todos los productos tienen un margen saludable.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
          
          {/* PANEL IZQUIERDO: AJUSTE DE PRECIOS */}
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '32px', border: '1px solid var(--border-focus)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: 'radial-gradient(circle, rgba(20,187,166, 0.05) 0%, transparent 60%)', zIndex: 0 }}></div>
            
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Icons.Brain />
                  Ajuste de Precios Sugerido
                </h3>
                <span style={{ background: 'rgba(20,187,166, 0.2)', color: '#a5b4fc', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 800 }}>{suggestions.length} producto{suggestions.length !== 1 ? 's' : ''}</span>
              </div>
              
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '32px', lineHeight: '1.6' }}>Productos cuyo margen de ganancia está por debajo del umbral recomendado.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                {suggestions.slice(0, 10).map((item, idx) => (
                  <div key={item.product_id || idx} style={{ background: 'var(--bg-main)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
                     <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '4px', background: idx < 3 ? 'var(--accent-warning)' : 'var(--accent-danger)' }}></div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                       <div>
                         <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: '4px' }}>{item.product_name || item.name}</div>
                         <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <span style={{ color: 'var(--accent-danger)', display: 'flex', alignItems: 'center', gap: '4px' }}><Icons.TrendingUp /> Costo: ${item.cost_price || item.current_cost}</span>
                         </div>
                       </div>
                       <div style={{ textAlign: 'right' }}>
                         <div style={{ textDecoration: 'line-through', color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '4px' }}>Actual: ${item.price || item.current_price}</div>
                         <div style={{ fontWeight: 800, color: 'var(--accent-success)', fontSize: '1.4rem' }}>Sugerido: ${item.suggested_price || item.target_price}</div>
                       </div>
                     </div>
                     <div style={{ height: '6px', background: 'var(--bg-main)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, item.margin_pct || item.current_margin || 50)}%`, height: '100%', background: idx < 3 ? 'var(--gradient-warning)' : 'var(--gradient-danger)' }}></div>
                     </div>
                  </div>
                ))}
              </div>
              
              <button onClick={handleApplyPrices} style={{ width: '100%', padding: '20px', borderRadius: '12px', background: 'var(--gradient-primary)', color: 'white', fontWeight: 800, fontSize: '1.1rem', border: 'none', cursor: 'pointer', marginTop: '24px', boxShadow: '0 4px 15px rgba(20,187,166, 0.4)', transition: 'all 0.15s' }} onMouseEnter={e=>e.target.style.transform='translateY(-2px)'} onMouseLeave={e=>e.target.style.transform='none'}>
                Aplicar Nuevos Precios Automáticamente
              </button>
            </div>
          </div>

          {/* PANEL DERECHO */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '32px', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden', flex: 1 }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--accent-warning)' }}></div>
              
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Icons.AlertTriangle /> Capital Inmovilizado
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '24px', lineHeight: '1.6' }}>
                Productos con nula rotacion en los ultimos 30 dias.
              </p>

              {deadStock.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                  No se encontraron productos sin rotacion.
                </div>
              ) : (
                deadStock.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: '4px' }}>{item.name || item.product_name}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{item.stock || 0} unidades estancadas</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--accent-danger)', fontWeight: 800, fontSize: '1.2rem' }}>${((item.price || 0) * (item.stock || 0)).toLocaleString('es-AR')}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Retenidos</div>
                    </div>
                  </div>
                ))
              )}
              
              <button onClick={handleCreatePromo} style={{ width: '100%', padding: '16px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.15s' }} onMouseEnter={e=>e.target.style.background='rgba(255,255,255,0.1)'} onMouseLeave={e=>e.target.style.background='rgba(255,255,255,0.05)'}>
                Armar Promo 2x1 (Liberar Stock)
              </button>
            </div>
            
          </div>
          
        </div>
      )}
    </div>
    </FeatureGate>
  );
}
