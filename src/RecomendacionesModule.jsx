import React from 'react';

const Icons = {
  Brain: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>,
  TrendingUp: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
  AlertTriangle: () => <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  CloudRain: () => <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16h16M4 16a4 4 0 01-4-4 4 4 0 014-4 4 4 0 017.2-2.1A6 6 0 0120 12a4 4 0 010 8m-4 4v-4m-4 4v-4m-4 4v-4" /></svg>
};

export default function RecomendacionesModule() {
  return (
    <div style={{ padding: '32px 40px', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', flexShrink: 0 }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Recomendaciones IA</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: 0 }}>Motor de inteligencia predictiva para maximizar tus márgenes de ganancia.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
        
        {/* PANEL IZQUIERDO: AJUSTE DE PRECIOS */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '32px', border: '1px solid var(--border-focus)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: 'radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, transparent 60%)', zIndex: 0, animation: 'pulseAura 4s infinite' }}></div>
          
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Icons.Brain />
                Ajuste de Precios Sugerido
              </h3>
              <span style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 800 }}>Alta Prioridad</span>
            </div>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '32px', lineHeight: '1.6' }}>El motor detectó que estos productos están sufriendo pérdida de rentabilidad debido al desfasaje inflacionario.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
              
              {/* ITEM 1 */}
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
                 <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '4px', background: 'var(--accent-warning)' }}></div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                   <div>
                     <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: '4px' }}>Alfajor Rasta</div>
                     <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <span style={{ color: 'var(--accent-danger)', display: 'flex', alignItems: 'center', gap: '4px' }}><Icons.TrendingUp /> Costo subió 15% ayer</span>
                     </div>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                     <div style={{ textDecoration: 'line-through', color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '4px' }}>Actual: $800</div>
                     <div style={{ fontWeight: 800, color: 'var(--accent-success)', fontSize: '1.4rem' }}>Sugerido: $950</div>
                   </div>
                 </div>
                 <div style={{ height: '6px', background: 'var(--bg-main)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '85%', height: '100%', background: 'var(--gradient-warning)' }}></div>
                 </div>
              </div>

              {/* ITEM 2 */}
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
                 <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '4px', background: 'var(--accent-danger)' }}></div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                   <div>
                     <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: '4px' }}>Coca Cola 1.5L</div>
                     <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <span style={{ color: 'var(--accent-danger)', display: 'flex', alignItems: 'center', gap: '4px' }}><Icons.AlertTriangle /> Margen crítico (4 meses sin subir)</span>
                     </div>
                   </div>
                   <div style={{ textAlign: 'right' }}>
                     <div style={{ textDecoration: 'line-through', color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '4px' }}>Actual: $3.500</div>
                     <div style={{ fontWeight: 800, color: 'var(--accent-success)', fontSize: '1.4rem' }}>Sugerido: $4.200</div>
                   </div>
                 </div>
                 <div style={{ height: '6px', background: 'var(--bg-main)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: '95%', height: '100%', background: 'var(--gradient-danger)' }}></div>
                 </div>
              </div>
            </div>
            
            <button onClick={() => alert('Actualización masiva de precios completada')} style={{ width: '100%', padding: '20px', borderRadius: '12px', background: 'var(--gradient-primary)', color: 'white', fontWeight: 800, fontSize: '1.1rem', border: 'none', cursor: 'pointer', marginTop: '24px', boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)', transition: 'all 0.2s' }} onMouseEnter={e=>e.target.style.transform='translateY(-2px)'} onMouseLeave={e=>e.target.style.transform='none'}>
              Aplicar Nuevos Precios Automáticamente
            </button>
          </div>
        </div>

        {/* PANEL DERECHO: PREDICCION DE DEMANDA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '32px', border: '1px solid var(--border-color)', flex: 1, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--accent-success)' }}></div>
            
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Icons.TrendingUp /> Predicción de Demanda
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '24px', lineHeight: '1.6' }}>El sistema cruzó tus datos de ventas con el pronóstico climático de tu región.</p>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', background: 'var(--bg-main)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ color: '#60A5FA' }}>
                 <Icons.CloudRain />
              </div>
              <div>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', fontSize: '1.15rem' }}>Ola de frío intenso entrante</div>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>Sugerimos abastecerte de café, chocolate para taza y alfajores.</div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                  <span style={{ color: 'var(--accent-success)', fontWeight: 800, fontSize: '1rem' }}>+45% demanda esperada</span>
                  <div style={{ height: '8px', width: '120px', background: 'var(--bg-card)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', background: 'var(--gradient-success)' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '32px', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--accent-warning)' }}></div>
            
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Icons.AlertTriangle /> Capital Inmovilizado
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '24px', lineHeight: '1.6' }}>Detectamos productos con nula rotación en los últimos 60 días.</p>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: '4px' }}>Chicles Beldent Fresa</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>45 unidades estancadas</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--accent-danger)', fontWeight: 800, fontSize: '1.2rem' }}>$22.500</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Retenidos</div>
              </div>
            </div>
            
            <button style={{ width: '100%', padding: '16px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e=>e.target.style.background='rgba(255,255,255,0.1)'} onMouseLeave={e=>e.target.style.background='rgba(255,255,255,0.05)'}>
              Armar Promo 2x1 (Liberar Stock)
            </button>
          </div>
          
        </div>
        
      </div>

      <div style={{ marginTop: '32px', background: 'var(--bg-card)', borderRadius: '16px', padding: '32px', border: '1px solid var(--border-color)', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ position: 'absolute', right: '-5%', top: '-20%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, transparent 70%)', zIndex: 0 }}></div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Icons.Brain /> Productos Sugeridos por IA
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: 0 }}>Basado en las tendencias de ventas de comercios de tu zona.</p>
            </div>
            <span style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#d8b4fe', padding: '6px 16px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 800 }}>Oportunidad de Negocio</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
            {[
              { name: 'Gomitas Mogul Extremes', reason: 'Tendencia en escuelas cercanas', margin: '45%' },
              { name: 'Monster Energy Mango', reason: 'Alta demanda fin de semana', margin: '35%' },
              { name: 'Cigarrillos Marlboro', reason: 'Faltante frecuente reportado', margin: '15%' }
            ].map((item, idx) => (
              <div key={idx} style={{ background: 'rgba(0,0,0,0.3)', padding: '24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: '8px' }}>{item.name}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px', height: '40px' }}>{item.reason}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: 'var(--accent-success)', fontWeight: 800, fontSize: '0.95rem' }}>Margen: {item.margin}</div>
                  <button style={{ background: 'var(--gradient-primary)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>Añadir</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
