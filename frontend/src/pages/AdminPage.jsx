import React, { useState, useEffect } from 'react';

const API = import.meta.env.PROD ? '/api/admin' : 'http://localhost:8005/api/admin';

const PLAN = { trial: { label: 'Trial', color: '#64748B' }, simple: { label: 'Simple', color: '#3B82F6' }, pro: { label: 'Pro', color: '#14BBA6' }, ia: { label: 'IA', color: '#F59E0B' } };
const STATUS = { active: { label: 'Activo', color: '#10B981' }, suspended: { label: 'Suspendido', color: '#EF4444' }, expired: { label: 'Expirado', color: '#F59E0B' } };

function fetchAdmin(url, token, opts = {}) {
  return fetch(url, { ...opts, headers: { ...opts.headers, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
}

function fmtDate(d) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }); } catch { return '—'; } }
function fmtPesos(n) { return '$' + (n || 0).toLocaleString('es-AR'); }
function fmtNum(n) { return (n || 0).toLocaleString('es-AR'); }

const S = {
  card: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 24 },
  btn: (active) => ({ padding: '7px 16px', borderRadius: 7, border: 'none', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s', background: active ? 'rgba(20,187,166,0.12)' : 'transparent', color: active ? '#14BBA6' : '#94A3B8' }),
  input: { width: '100%', padding: '9px 13px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#E2E8F0', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' },
  select: { padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#E2E8F0', fontSize: '0.82rem', outline: 'none', cursor: 'pointer' },
  primaryBtn: { padding: '9px 20px', background: 'linear-gradient(135deg, #14BBA6, #0F8A7D)', border: 'none', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' },
  dangerBtn: { padding: '6px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' },
};

/* ─── Login ─── */
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [ld, setLd] = useState(false);
  const submit = async e => { e.preventDefault(); setLd(true); setErr('');
    try { const r = await fetch(`${API}/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pw }) }); const d = await r.json(); if (r.ok) onLogin(d.access_token); else setErr(d.detail || 'Credenciales invalidas'); } catch { setErr('Error de conexion'); } setLd(false); };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0F1A' }}>
      <div style={{ width: 380, padding: '44px 40px', background: '#111827', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#F1F5F9', margin: '0 0 4px 0', letterSpacing: '-0.3px' }}>MiNegocio Admin</h1>
          <p style={{ color: '#64748B', fontSize: '0.85rem', margin: 0 }}>Panel de administracion</p>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus style={S.input} /></div>
          <div><label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', fontWeight: 600, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contrasena</label><input type="password" value={pw} onChange={e => setPw(e.target.value)} required style={S.input} /></div>
          {err && <div style={{ color: '#FCA5A5', fontSize: '0.82rem', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>{err}</div>}
          <button type="submit" disabled={ld} style={{ ...S.primaryBtn, padding: '12px', fontSize: '0.9rem', opacity: ld ? 0.6 : 1 }}>{ld ? 'Ingresando...' : 'Ingresar'}</button>
        </form>
      </div>
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ label, value, accent }) {
  return (
    <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 6, borderLeft: `3px solid ${accent}` }}>
      <div style={{ color: '#64748B', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#F1F5F9', letterSpacing: '-0.5px' }}>{value}</div>
    </div>
  );
}

/* ─── Badges ─── */
function PlanBadge({ plan }) { const p = PLAN[plan] || PLAN.trial; return <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: `${p.color}18`, color: p.color, border: `1px solid ${p.color}30` }}>{p.label}</span>; }
function StatusBadge({ status }) { const s = STATUS[status] || STATUS.active; return <span style={{ padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: `${s.color}18`, color: s.color, border: `1px solid ${s.color}30` }}>{s.label}</span>; }

/* ─── Toast ─── */
function Toast({ msg, onClose }) { if (!msg) return null; return <div onClick={onClose} style={{ position: 'fixed', top: 24, right: 24, background: '#065F46', color: '#D1FAE5', padding: '10px 20px', borderRadius: 8, fontWeight: 600, fontSize: '0.85rem', zIndex: 9999, cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>{msg}</div>; }

/* ─── Main ─── */
export default function AdminPage() {
  const [token, setToken] = useState(''); const [tab, setTab] = useState('dashboard'); const [toast, setToast] = useState('');
  if (!token) return <LoginScreen onLogin={t => setToken(t)} />;
  const s = msg => { setToast(msg); setTimeout(() => setToast(''), 2800); };
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0A0F1A', overflow: 'hidden' }}>
      <div style={{ padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', background: '#111827', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F1F5F9', margin: 0, letterSpacing: '-0.2px' }}>MiNegocio Admin</h1>
          <div style={{ display: 'flex', gap: 2 }}>
            {['dashboard','businesses','audit'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={S.btn(tab === t)}>
                {t === 'dashboard' ? 'Dashboard' : t === 'businesses' ? 'Negocios' : 'Auditoria'}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => setToken('')} style={{ padding: '6px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', borderRadius: 7, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Cerrar sesion</button>
      </div>
      <Toast msg={toast} onClose={() => setToast('')} />
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
        {tab === 'dashboard' && <Dashboard token={token} />}
        {tab === 'businesses' && <Businesses token={token} toast={s} />}
        {tab === 'audit' && <Audit token={token} />}
      </div>
    </div>
  );
}

/* ─── Dashboard ─── */
function Dashboard({ token }) {
  const [m, setM] = useState(null);
  useEffect(() => { fetchAdmin(`${API}/metrics`, token).then(r => r.json()).then(setM); }, [token]);
  if (!m) return <div style={{ textAlign: 'center', padding: 80, color: '#475569' }}>Cargando metricas...</div>;
  const total = m.total_businesses || 1;
  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Total Negocios" value={fmtNum(m.total_businesses)} accent="#3B82F6" />
        <StatCard label="Activos" value={fmtNum(m.active_subscriptions)} accent="#10B981" />
        <StatCard label="Suspendidos" value={fmtNum(m.suspended)} accent="#EF4444" />
        <StatCard label="MRR Mensual" value={fmtPesos(m.mrr)} accent="#14BBA6" />
        <StatCard label="Churn 30d" value={fmtNum(m.churn_this_month)} accent="#F59E0B" />
        <StatCard label="Conversion Trial" value={`${m.trial_conversions}%`} accent="#8B5CF6" />
      </div>

      <div style={S.card}>
        <h3 style={{ color: '#94A3B8', fontSize: '0.75rem', fontWeight: 600, margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Distribucion por plan</h3>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Object.entries(m.breakdown_by_plan || {}).map(([plan, count]) => {
            const pct = Math.round(count / total * 100);
            return (
              <div key={plan} style={{ flex: '1 1 100px', minWidth: 100, background: 'rgba(255,255,255,0.02)', borderRadius: 10, padding: '16px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: PLAN[plan]?.color || '#fff', letterSpacing: '-0.5px' }}>{count}</div>
                <div style={{ color: '#64748B', fontSize: '0.75rem', fontWeight: 600, marginTop: 2 }}>{PLAN[plan]?.label || plan}</div>
                <div style={{ marginTop: 10, height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: PLAN[plan]?.color || '#fff', borderRadius: 2, transition: 'width 0.5s' }} />
                </div>
                <div style={{ color: '#475569', fontSize: '0.7rem', marginTop: 4 }}>{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Businesses ─── */
function Businesses({ token, toast }) {
  const [data, setData] = useState(null); const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  const [sFilter, setSFilter] = useState(''); const [pFilter, setPFilter] = useState(''); const [detail, setDetail] = useState(null); const [del, setDel] = useState(null);

  const load = async () => {
    const q = new URLSearchParams({ page, limit: 12 }); if (search) q.set('search', search); if (sFilter) q.set('status', sFilter); if (pFilter) q.set('plan', pFilter);
    const r = await fetchAdmin(`${API}/businesses?${q}`, token); if (r.ok) setData(await r.json());
  };
  useEffect(() => { load(); }, [page, sFilter, pFilter]);

  const doSearch = e => { e.preventDefault(); setPage(1); load(); };
  const chPlan = async (id, np) => { if (!window.confirm(`Cambiar plan a ${PLAN[np]?.label || np}?`)) return; const r = await fetchAdmin(`${API}/businesses/${id}/plan`, token, { method: 'PUT', body: JSON.stringify({ new_plan: np, notes: 'Actualizacion manual' }) }); if (r.ok) { toast('Plan actualizado'); load(); } };
  const chStatus = async (id, ns) => { const r = await fetchAdmin(`${API}/businesses/${id}/status`, token, { method: 'PUT', body: JSON.stringify({ status: ns, reason: 'Accion administrativa' }) }); if (r.ok) { toast('Estado actualizado'); load(); } };
  const doDelete = async (id, name) => {
    if (!window.confirm(`Eliminar permanentemente "${name}"?\n\nEsta accion borrara todos los datos del negocio: productos, ventas, operadores, configuracion. No se puede deshacer.`)) return;
    setDel(id); const r = await fetchAdmin(`${API}/businesses/${id}`, token, { method: 'DELETE' }); setDel(null);
    if (r.ok) { toast('Negocio eliminado'); load(); } else toast('Error al eliminar');
  };
  const showDetail = async id => { const r = await fetchAdmin(`${API}/businesses/${id}`, token); if (r.ok) setDetail(await r.json()); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <form onSubmit={doSearch} style={{ display: 'flex', gap: 8, flex: 1 }}>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nombre o email..." style={{ ...S.input, maxWidth: 280 }} />
          <button type="submit" style={S.primaryBtn}>Buscar</button>
        </form>
        <select value={sFilter} onChange={e => { setSFilter(e.target.value); setPage(1); }} style={S.select}><option value="">Estado</option><option value="active">Activo</option><option value="suspended">Suspendido</option><option value="expired">Expirado</option></select>
        <select value={pFilter} onChange={e => { setPFilter(e.target.value); setPage(1); }} style={S.select}><option value="">Plan</option><option value="trial">Trial</option><option value="simple">Simple</option><option value="pro">Pro</option><option value="ia">IA</option></select>
      </div>

      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#64748B', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Negocio</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Plan</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Estado</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Desde</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Ops</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map(biz => (
              <tr key={biz.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.015)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '11px 16px' }}><div style={{ fontWeight: 600, color: '#E2E8F0' }}>{biz.business_name}</div><div style={{ color: '#64748B', fontSize: '0.78rem' }}>{biz.email}</div></td>
                <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                  <select value={biz.plan} onChange={e => chPlan(biz.id, e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: 5, border: 'none', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', background: `${PLAN[biz.plan]?.color || '#666'}15`, color: PLAN[biz.plan]?.color || '#fff' }}>
                    <option value="trial">Trial</option><option value="simple">Simple</option><option value="pro">Pro</option><option value="ia">IA</option></select>
                </td>
                <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                  <select value={biz.status} onChange={e => chStatus(biz.id, e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: 5, border: 'none', fontWeight: 600, fontSize: '0.78rem', cursor: 'pointer', background: `${STATUS[biz.status]?.color || '#666'}15`, color: STATUS[biz.status]?.color || '#fff' }}>
                    <option value="active">Activo</option><option value="suspended">Suspendido</option><option value="expired">Expirado</option></select>
                </td>
                <td style={{ padding: '11px 16px', textAlign: 'center', color: '#64748B', fontSize: '0.8rem' }}>{fmtDate(biz.created_at)}</td>
                <td style={{ padding: '11px 16px', textAlign: 'center', color: '#14BBA6', fontWeight: 600, fontSize: '0.85rem' }}>{biz.operators_count}</td>
                <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    <button onClick={() => showDetail(biz.id)} style={{ padding: '5px 12px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#60A5FA', borderRadius: 5, fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer' }}>Ver</button>
                    <button onClick={() => doDelete(biz.id, biz.business_name)} disabled={del === biz.id} style={{ ...S.dangerBtn, opacity: del ? 0.4 : 1 }}>{del === biz.id ? '...' : 'Eliminar'}</button>
                  </div>
                </td>
              </tr>
            ))}
            {(!data?.data || data.data.length === 0) && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: '0.9rem' }}>Sin resultados</td></tr>}
          </tbody>
        </table>
      </div>

      {data && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#475569', fontSize: '0.85rem' }}>{data.total} negocios</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ ...S.btn(false), padding: '6px 14px', fontSize: '0.8rem' }}>Anterior</button>
            <span style={{ color: '#64748B', fontSize: '0.82rem' }}>Pagina {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={!data || data.data.length < data.limit} style={{ ...S.btn(false), padding: '6px 14px', fontSize: '0.8rem' }}>Siguiente</button>
          </div>
        </div>
      )}

      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 460, background: '#111827', border: '1px solid rgba(20,187,166,0.15)', borderRadius: 14, padding: 28, boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#F1F5F9', margin: '0 0 18px 0' }}>{detail.business_name}</h2>
            <table style={{ width: '100%', fontSize: '0.88rem', borderCollapse: 'collapse' }}>
              <tbody>
                {[['Email', 'email'], ['Telefono', 'phone'], ['Plan', 'plan'], ['Estado', 'status'], ['Productos', 'products_count'], ['Ventas', 'sales_count'], ['Operadores', 'operators_count'], ['Creado', 'created_at'], ['Ultima venta', 'last_sale']].map(([l, k]) => (
                  <tr key={k} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '9px 0', color: '#64748B' }}>{l}</td>
                    <td style={{ padding: '9px 0', textAlign: 'right', color: '#E2E8F0', fontWeight: 500 }}>
                      {k === 'plan' ? <PlanBadge plan={detail[k]} /> : k === 'status' ? <StatusBadge status={detail[k]} /> : k === 'created_at' || k === 'last_sale' ? fmtDate(detail[k]) : detail[k] || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setDetail(null)} style={{ width: '100%', marginTop: 20, ...S.primaryBtn }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Audit ─── */
function Audit({ token }) {
  const [logs, setLogs] = useState([]);
  useEffect(() => { fetchAdmin(`${API}/audit-log?days=60`, token).then(r => r.json()).then(setLogs); }, [token]);
  return (
    <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <span style={{ color: '#64748B', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Registro de actividad</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#64748B', fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Fecha</th>
            <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Administrador</th>
            <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Negocio</th>
            <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600 }}>Accion</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(l => (
            <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.015)' }}>
              <td style={{ padding: '10px 16px', color: '#64748B', fontSize: '0.8rem' }}>{new Date(l.timestamp).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
              <td style={{ padding: '10px 16px', color: '#94A3B8' }}>{l.superadmin_email || '—'}</td>
              <td style={{ padding: '10px 16px', color: '#E2E8F0' }}>{l.business_name || l.business_id?.slice(0, 8)}</td>
              <td style={{ padding: '10px 16px' }}><span style={{ padding: '3px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(20,187,166,0.1)', color: '#14BBA6' }}>{l.action}</span></td>
            </tr>
          ))}
          {logs.length === 0 && <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#475569' }}>Sin actividad registrada</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
