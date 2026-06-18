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

const BG = '#070B16';
const CARD = '#0D1326';
const BORDER = 'rgba(20,187,166,0.08)';
const TEXT = '#E2E8F0';
const MUTED = '#64748B';
const ACCENT = '#14BBA6';

const S = {
  card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 28, boxShadow: '0 4px 24px rgba(0,0,0,0.3)' },
  btn: (active) => ({ padding: '8px 18px', borderRadius: 8, border: active ? '1px solid rgba(20,187,166,0.3)' : '1px solid transparent', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer', transition: 'all 0.2s', background: active ? 'rgba(20,187,166,0.1)' : 'transparent', color: active ? ACCENT : MUTED }),
  input: { width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: TEXT, fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' },
  select: { padding: '9px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: TEXT, fontSize: '0.84rem', outline: 'none', cursor: 'pointer' },
  primaryBtn: { padding: '10px 22px', background: `linear-gradient(135deg, ${ACCENT}, #0F8A7D)`, border: 'none', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer', boxShadow: '0 4px 16px rgba(20,187,166,0.25)', transition: 'all 0.2s' },
  dangerBtn: { padding: '7px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', borderRadius: 8, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' },
  pill: (color) => ({ padding: '4px 10px', borderRadius: 6, fontSize: '0.74rem', fontWeight: 700, background: `${color}16`, color: color, border: `1px solid ${color}28`, display: 'inline-flex', alignItems: 'center', gap: 4 }),
};

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [ld, setLd] = useState(false);
  const submit = async e => { e.preventDefault(); setLd(true); setErr('');
    try { const r = await fetch(`${API}/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pw }) }); const d = await r.json(); if (r.ok) onLogin(d.access_token); else setErr(d.detail || 'Credenciales invalidas'); } catch { setErr('Error de conexion'); } setLd(false); };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: `radial-gradient(ellipse at 50% 0%, rgba(20,187,166,0.06) 0%, transparent 60%), ${BG}`, padding: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${ACCENT}, #0F8A7D)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 32px rgba(20,187,166,0.3)' }}>
          <svg width="28" height="28" fill="none" stroke="#fff" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#F1F5F9', margin: 0, letterSpacing: '-0.3px' }}>MiNegocio Admin</h1>
        <p style={{ color: MUTED, fontSize: '0.88rem', margin: '6px 0 0 0' }}>Panel de administracion global</p>
      </div>
      <form onSubmit={submit} style={{ width: 380, padding: '40px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, boxShadow: '0 24px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.74rem', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus placeholder="admin@minegocio.app" style={S.input} onFocus={e => e.target.style.borderColor = ACCENT} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
        </div>
        <div>
          <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.74rem', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Contrasena</label>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} required placeholder="••••••••" style={S.input} onFocus={e => e.target.style.borderColor = ACCENT} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
        </div>
        {err && <div style={{ color: '#FCA5A5', fontSize: '0.84rem', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 10, fontWeight: 500 }}>{err}</div>}
        <button type="submit" disabled={ld} style={{ ...S.primaryBtn, padding: '14px', fontSize: '0.95rem', width: '100%', marginTop: 4, opacity: ld ? 0.6 : 1, transform: ld ? 'none' : 'translateY(0)' }}
          onMouseEnter={e => { if (!ld) e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(20,187,166,0.35)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(20,187,166,0.25)'; }}>
          {ld ? 'Ingresando...' : 'Ingresar al panel'}
        </button>
        <p style={{ textAlign: 'center', color: MUTED, fontSize: '0.78rem', marginTop: 8 }}>Acceso exclusivo para administradores</p>
      </form>
    </div>
  );
}

function StatCard({ label, value, accent, sub }) {
  return (
    <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 8, borderLeft: `3px solid ${accent}`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: `${accent}08`, pointerEvents: 'none' }} />
      <div style={{ color: MUTED, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: MUTED, fontSize: '0.76rem', fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

function Pill({ color, children }) {
  return <span style={S.pill(color)}>{children}</span>;
}

function Toast({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', bottom: 32, right: 32, background: `linear-gradient(135deg, #065F46, #047857)`, color: '#D1FAE5', padding: '14px 24px', borderRadius: 12, fontWeight: 600, fontSize: '0.88rem', zIndex: 9999, cursor: 'pointer', boxShadow: '0 12px 32px rgba(0,0,0,0.4)', animation: 'scaleIn 0.2s ease-out', display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><polyline points="20,6 9,17 4,12"/></svg>
      {msg}
    </div>
  );
}

export default function AdminPage() {
  const [token, setToken] = useState(''); const [tab, setTab] = useState('dashboard'); const [toast, setToast] = useState('');
  if (!token) return <LoginScreen onLogin={t => { setToken(t); localStorage.setItem('admin_token', t); }} />;
  const s = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>
      <header style={{ padding: '0 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${BORDER}`, background: 'rgba(13,19,38,0.8)', backdropFilter: 'blur(20px)', flexShrink: 0, minHeight: 60 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg, ${ACCENT}, #0F8A7D)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" fill="none" stroke="#fff" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
            </div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#F1F5F9', margin: 0, letterSpacing: '-0.2px' }}>Admin Panel</h1>
          </div>
          <nav style={{ display: 'flex', gap: 2 }}>
            {[
              { key: 'dashboard', label: 'Dashboard', icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> },
              { key: 'businesses', label: 'Negocios', icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
              { key: 'audit', label: 'Auditoria', icon: <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={S.btn(tab === t.key)}>
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
        </div>
        <button onClick={() => { setToken(''); localStorage.removeItem('admin_token'); }} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: MUTED, borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
          onMouseLeave={e => { e.currentTarget.style.color = MUTED; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Salir
        </button>
      </header>
      <Toast msg={toast} onClose={() => setToast('')} />
      <main style={{ flex: 1, overflow: 'auto', padding: '32px' }}>
        {tab === 'dashboard' && <Dashboard token={token} />}
        {tab === 'businesses' && <Businesses token={token} toast={s} />}
        {tab === 'audit' && <Audit token={token} />}
      </main>
    </div>
  );
}

function Dashboard({ token }) {
  const [m, setM] = useState(null);
  useEffect(() => { fetchAdmin(`${API}/metrics`, token).then(r => r.json()).then(setM); }, [token]);
  if (!m) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 20 }}>
      <div style={{ width: 40, height: 40, border: `3px solid ${BORDER}`, borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ color: MUTED, fontSize: '0.9rem' }}>Cargando metricas...</span>
    </div>
  );
  const total = m.total_businesses || 1;
  return (
    <div style={{ maxWidth: 1100 }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#F1F5F9', margin: '0 0 24px 0', letterSpacing: '-0.2px' }}>Resumen general</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard label="Total Negocios" value={fmtNum(m.total_businesses)} accent="#3B82F6" />
        <StatCard label="Activos" value={fmtNum(m.active_subscriptions)} accent="#10B981" sub={`${Math.round(m.active_subscriptions / total * 100)}% del total`} />
        <StatCard label="Suspendidos" value={fmtNum(m.suspended)} accent="#EF4444" />
        <StatCard label="MRR Mensual" value={fmtPesos(m.mrr)} accent="#14BBA6" sub="Ingresos recurrentes" />
        <StatCard label="Churn 30 dias" value={fmtNum(m.churn_this_month)} accent="#F59E0B" />
        <StatCard label="Conversion Trial" value={`${m.trial_conversions}%`} accent="#8B5CF6" sub="A plan pago" />
      </div>

      <div style={S.card}>
        <h3 style={{ color: '#94A3B8', fontSize: '0.72rem', fontWeight: 700, margin: '0 0 20px 0', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Distribucion por plan</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          {Object.entries(m.breakdown_by_plan || {}).map(([plan, count]) => {
            const pct = Math.round(count / total * 100);
            const c = PLAN[plan]?.color || '#fff';
            return (
              <div key={plan} style={{ background: 'rgba(255,255,255,0.015)', borderRadius: 14, padding: '20px', textAlign: 'center', border: `1px solid ${BORDER}`, transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.015)'; e.currentTarget.style.transform = 'translateY(0)' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: c, letterSpacing: '-0.5px' }}>{count}</div>
                <div style={{ color: '#94A3B8', fontSize: '0.8rem', fontWeight: 600, marginTop: 4 }}>{PLAN[plan]?.label || plan}</div>
                <div style={{ marginTop: 12, height: 5, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${c}, ${c}88)`, borderRadius: 3, transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ color: MUTED, fontSize: '0.72rem', marginTop: 6, fontWeight: 500 }}>{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {m.top_features_used && m.top_features_used.length > 0 && (
        <div style={{ ...S.card, marginTop: 20 }}>
          <h3 style={{ color: '#94A3B8', fontSize: '0.72rem', fontWeight: 700, margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Features mas usadas</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {m.top_features_used.map(f => (
              <div key={f.feature} style={{ flex: 1, minWidth: 150, background: 'rgba(20,187,166,0.04)', borderRadius: 12, padding: '16px 20px', border: '1px solid rgba(20,187,166,0.08)' }}>
                <div style={{ color: ACCENT, fontSize: '1.2rem', fontWeight: 700 }}>{fmtNum(f.count)}</div>
                <div style={{ color: MUTED, fontSize: '0.78rem', marginTop: 2 }}>{f.feature}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#F1F5F9', margin: 0, letterSpacing: '-0.2px' }}>Gestion de negocios</h2>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <form onSubmit={doSearch} style={{ display: 'flex', gap: 10, flex: 1 }}>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nombre o email..." style={{ ...S.input, maxWidth: 300 }} onFocus={e => e.target.style.borderColor = ACCENT} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
          <button type="submit" style={S.primaryBtn}>Buscar</button>
        </form>
        <select value={sFilter} onChange={e => { setSFilter(e.target.value); setPage(1); }} style={S.select}><option value="">Todos los estados</option><option value="active">Activo</option><option value="suspended">Suspendido</option><option value="expired">Expirado</option></select>
        <select value={pFilter} onChange={e => { setPFilter(e.target.value); setPage(1); }} style={S.select}><option value="">Todos los planes</option><option value="trial">Trial</option><option value="simple">Simple</option><option value="pro">Pro</option><option value="ia">IA</option></select>
      </div>

      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}`, color: MUTED, fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.6px', background: 'rgba(255,255,255,0.01)' }}>
              <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 600 }}>Negocio</th>
              <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 600 }}>Plan</th>
              <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 600 }}>Estado</th>
              <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 600 }}>Desde</th>
              <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 600 }}>Ops</th>
              <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 600 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map(biz => (
              <tr key={biz.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.02)`, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(20,187,166,0.03)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '14px 20px' }}>
                  <div style={{ fontWeight: 600, color: TEXT }}>{biz.business_name}</div>
                  <div style={{ color: MUTED, fontSize: '0.78rem', marginTop: 2 }}>{biz.email}</div>
                </td>
                <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                  <select value={biz.plan} onChange={e => chPlan(biz.id, e.target.value)}
                    style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${PLAN[biz.plan]?.color || '#666'}25`, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', background: `${PLAN[biz.plan]?.color || '#666'}10`, color: PLAN[biz.plan]?.color || '#fff', outline: 'none' }}>
                    <option value="trial">Trial</option><option value="simple">Simple</option><option value="pro">Pro</option><option value="ia">IA</option></select>
                </td>
                <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                  <select value={biz.status} onChange={e => chStatus(biz.id, e.target.value)}
                    style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${STATUS[biz.status]?.color || '#666'}25`, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', background: `${STATUS[biz.status]?.color || '#666'}10`, color: STATUS[biz.status]?.color || '#fff', outline: 'none' }}>
                    <option value="active">Activo</option><option value="suspended">Suspendido</option><option value="expired">Expirado</option></select>
                </td>
                <td style={{ padding: '14px 20px', textAlign: 'center', color: MUTED, fontSize: '0.82rem' }}>{fmtDate(biz.created_at)}</td>
                <td style={{ padding: '14px 20px', textAlign: 'center', color: ACCENT, fontWeight: 700, fontSize: '0.88rem' }}>{biz.operators_count}</td>
                <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button onClick={() => showDetail(biz.id)} style={{ padding: '6px 14px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#60A5FA', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.15)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(59,130,246,0.08)'}>Detalle</button>
                    <button onClick={() => doDelete(biz.id, biz.business_name)} disabled={del === biz.id}
                      style={{ ...S.dangerBtn, opacity: del ? 0.4 : 1 }}
                      onMouseEnter={e => { if (!del) e.currentTarget.style.background = 'rgba(239,68,68,0.15)' }} onMouseLeave={e => { if (!del) e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}>{del === biz.id ? '...' : 'Eliminar'}</button>
                  </div>
                </td>
              </tr>
            ))}
            {(!data?.data || data.data.length === 0) && <tr><td colSpan={6} style={{ padding: 50, textAlign: 'center', color: MUTED, fontSize: '0.9rem' }}>Sin resultados</td></tr>}
          </tbody>
        </table>
      </div>

      {data && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
          <span style={{ color: MUTED, fontSize: '0.84rem' }}>{data.total} negocios encontrados</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ ...S.btn(false), padding: '8px 16px', fontSize: '0.82rem', opacity: page <= 1 ? 0.4 : 1 }}>Anterior</button>
            <span style={{ color: MUTED, fontSize: '0.84rem', fontWeight: 500 }}>Pag. {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={!data || data.data.length < data.limit} style={{ ...S.btn(false), padding: '8px 16px', fontSize: '0.82rem', opacity: data?.data?.length < data?.limit ? 0.4 : 1 }}>Siguiente</button>
          </div>
        </div>
      )}

      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 480, background: CARD, border: `1px solid rgba(20,187,166,0.15)`, borderRadius: 18, padding: 32, boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(20,187,166,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(20,187,166,0.2)' }}>
                <svg width="20" height="20" fill="none" stroke={ACCENT} viewBox="0 0 24 24" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
              </div>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{detail.business_name}</h2>
                <span style={{ color: MUTED, fontSize: '0.84rem' }}>{detail.email}</span>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[['Plan', 'plan', 'badge-plan'], ['Estado', 'status', 'badge-status'], ['Telefono', 'phone'], ['Productos', 'products_count'], ['Ventas', 'sales_count'], ['Operadores', 'operators_count'], ['Creado', 'created_at', 'date'], ['Ultima venta', 'last_sale', 'date']].map(([l, k, t]) => (
                <div key={k} style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.015)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ color: MUTED, fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{l}</div>
                  <div style={{ color: TEXT, fontWeight: 600, fontSize: '0.9rem' }}>
                    {t === 'badge-plan' ? <Pill color={PLAN[detail[k]]?.color || '#666'}>{PLAN[detail[k]]?.label || detail[k]}</Pill> :
                     t === 'badge-status' ? <Pill color={STATUS[detail[k]]?.color || '#666'}>{STATUS[detail[k]]?.label || detail[k]}</Pill> :
                     t === 'date' ? fmtDate(detail[k]) : detail[k] || '—'}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setDetail(null)} style={{ ...S.primaryBtn, width: '100%', marginTop: 20, padding: '12px' }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Audit({ token }) {
  const [logs, setLogs] = useState([]);
  useEffect(() => { fetchAdmin(`${API}/audit-log?days=60`, token).then(r => r.json()).then(setLogs); }, [token]);
  return (
    <div>
      <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#F1F5F9', margin: '0 0 24px 0', letterSpacing: '-0.2px' }}>Registro de actividad</h2>
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}`, color: MUTED, fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.6px', background: 'rgba(255,255,255,0.01)' }}>
              <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 600 }}>Fecha</th>
              <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 600 }}>Administrador</th>
              <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 600 }}>Negocio</th>
              <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 600 }}>Accion</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} style={{ borderBottom: `1px solid rgba(255,255,255,0.015)`, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '12px 20px', color: MUTED, fontSize: '0.82rem', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{new Date(l.timestamp).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                <td style={{ padding: '12px 20px', color: '#94A3B8' }}>{l.superadmin_email || '—'}</td>
                <td style={{ padding: '12px 20px', color: TEXT, fontWeight: 500 }}>{l.business_name || l.business_id?.slice(0, 8)}</td>
                <td style={{ padding: '12px 20px' }}><Pill color={ACCENT}>{l.action}</Pill></td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td colSpan={4} style={{ padding: 50, textAlign: 'center', color: MUTED, fontSize: '0.9rem' }}>Sin actividad registrada</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
