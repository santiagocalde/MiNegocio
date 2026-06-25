import React, { useState, useEffect } from 'react';

const API = import.meta.env.PROD ? '/api/admin' : 'http://localhost:8005/api/admin';

const PLAN = { trial: { label: 'Trial', color: '#64748B' }, simple: { label: 'Simple', color: '#3B82F6' }, pro: { label: 'Pro', color: '#14BBA6' }, ia: { label: 'IA', color: '#F59E0B' } };
const STATUS = { active: { label: 'Activo', color: '#10B981' }, suspended: { label: 'Suspendido', color: '#EF4444' }, expired: { label: 'Expirado', color: '#F59E0B' }, past_due: { label: 'En Mora', color: '#F97316' } };
const SUPERADMIN_EMAILS = ['calderonsantiago2019@gmail.com', 'admin@minegocio.app'];

function fetchAdmin(url, token, opts = {}) {
  return fetch(url, { ...opts, headers: { ...opts.headers, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }).catch(err => { console.warn('Admin fetch failed:', url, err.message); return Response.error(); });
}

function fmtDate(d) { if (!d) return '—'; try { return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }); } catch { return '—'; } }
function fmtPesos(n) { return '$' + Number(n || 0).toLocaleString('es-AR'); }
function fmtNum(n) { return Number(n || 0).toLocaleString('es-AR'); }
function fmtTime(d) { if (!d) return '—'; try { const t = new Date(d); return `${t.getHours().toString().padStart(2,'0')}:${t.getMinutes().toString().padStart(2,'0')}`; } catch { return '—'; } }

// Paleta Ocean Dark — alineada con el panel del operador (var(--bg-main)/--bg-card)
const BG = '#0B132B';
const CARD = '#121E36';
const BORDER = 'rgba(255,255,255,0.06)';
const TEXT = '#E6FFFB';
const MUTED = 'rgba(230,255,251,0.5)';
const ACCENT = '#14BBA6';

const S = {
  card: { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, boxShadow: '0 2px 16px rgba(0,0,0,0.2)' },
  statCard: (color) => ({ background: `linear-gradient(135deg, ${CARD}, ${color}08)`, border: `1px solid ${color}18`, borderRadius: 14, padding: '20px 24px', position: 'relative', overflow: 'hidden' }),
  btn: (active) => ({ padding: '8px 16px', borderRadius: 8, border: active ? '1px solid rgba(20,187,166,0.25)' : '1px solid transparent', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s', background: active ? 'rgba(20,187,166,0.08)' : 'transparent', color: active ? ACCENT : MUTED, display: 'inline-flex', alignItems: 'center', gap: 6 }),
  input: { width: '100%', padding: '9px 13px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9, color: TEXT, fontSize: '0.86rem', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' },
  select: { padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 9, color: TEXT, fontSize: '0.82rem', outline: 'none', cursor: 'pointer' },
  primaryBtn: { padding: '9px 20px', background: `linear-gradient(135deg, ${ACCENT}, #0F8A7D)`, border: 'none', color: '#fff', borderRadius: 9, fontWeight: 700, fontSize: '0.84rem', cursor: 'pointer', boxShadow: '0 3px 12px rgba(20,187,166,0.2)', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: 6 },
  ghostBtn: { padding: '8px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: MUTED, borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: 5 },
  pill: (color, text) => ({ padding: '3px 9px', borderRadius: 5, fontSize: '0.72rem', fontWeight: 700, background: `${color}15`, color: color, border: `1px solid ${color}25`, display: 'inline-flex', alignItems: 'center', gap: 4 }),
  tableTh: { padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.6px', color: MUTED, borderBottom: `1px solid ${BORDER}` },
  tableTd: { padding: '11px 16px', borderBottom: `1px solid rgba(255,255,255,0.015)`, fontWeight: 500, fontSize: '0.84rem' },
  skeleton: { background: 'rgba(255,255,255,0.03)', borderRadius: 8, animation: 'pulse 1.5s infinite' },
};

function isAdminAuthorized() {
  if (localStorage.getItem('saas_admin_gate') === 'true') return true;
  try { const raw = localStorage.getItem('saas_business'); if (raw) { const biz = JSON.parse(raw); if (biz?.email && SUPERADMIN_EMAILS.includes(biz.email)) { localStorage.setItem('saas_admin_gate', 'true'); return true; } } } catch {}
  return false;
}

/* ─── SVG Mini Chart ─── */
function MiniChart({ data, color, height = 60 }) {
  if (!data || data.length < 2) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: '0.7rem' }}>Sin datos</div>;
  const max = Math.max(...data) || 1;
  const min = Math.min(...data) || 0;
  const range = max - min || 1;
  const w = 200;
  const h = height;
  const pad = 2;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(' ');
  const area = `${pad},${h-pad} ${points} ${w-pad},${h-pad}`;
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <defs><linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.2"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <polygon points={area} fill={`url(#grad-${color})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BarChart({ data, color, height = 100 }) {
  if (!data || !Array.isArray(data) || data.length === 0) return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: '0.7rem' }}>Sin datos</div>;
  try {
    const maxVal = Math.max(...data.map(d => d?.count || d?.sales || 0)) || 1;
    const w = Math.min(Math.max(data.length * 16, 100), 500);
    const h = height;
    const barW = Math.max(4, Math.floor((w - data.length * 2) / data.length));
    return (
      <svg width={w} height={h} style={{ display: 'block', margin: '0 auto' }}>
        {data.map((d, i) => {
          const v = d?.count || d?.sales || 0;
          const bh = Math.max(2, (v / maxVal) * (h - 20));
          const x = i * (barW + 2) + 2;
          const y = h - bh - 14;
          return <rect key={i} x={x} y={y} width={barW} height={bh} rx="2" fill={color} opacity="0.8" />;
        })}
      </svg>
    );
  } catch { return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: '0.7rem' }}>Error al cargar grafico</div>; }
}


/* ─── Login Screen ─── */
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [ld, setLd] = useState(false);
  const submit = async e => { e.preventDefault(); setLd(true); setErr('');
    try { const r = await fetch(`${API}/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pw }) }); const d = await r.json(); if (r.ok) onLogin(d.access_token); else setErr(d.detail || 'Credenciales invalidas'); } catch { setErr('Error de conexion'); } setLd(false); };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: `radial-gradient(ellipse at 50% 0%, rgba(20,187,166,0.04) 0%, transparent 65%), ${BG}`, padding: 20 }}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg, ${ACCENT}, #0F8A7D)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 6px 24px rgba(20,187,166,0.25)' }}>
          <svg width="24" height="24" fill="none" stroke="#fff" viewBox="0 0 24 24" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>
        </div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F1F5F9', margin: 0, letterSpacing: '-0.3px' }}>Admin Panel</h1>
        <p style={{ color: MUTED, fontSize: '0.84rem', margin: '5px 0 0 0' }}>Gestion global de MiNegocio</p>
      </div>
      <form onSubmit={submit} style={{ width: 360, padding: '36px 32px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, boxShadow: '0 20px 50px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><label style={{ display: 'block', color: '#94A3B8', fontSize: '0.72rem', fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus placeholder="admin@minegocio.app" style={S.input} onFocus={e => e.target.style.borderColor = ACCENT} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'} /></div>
        <div><label style={{ display: 'block', color: '#94A3B8', fontSize: '0.72rem', fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Contrasena</label><input type="password" value={pw} onChange={e => setPw(e.target.value)} required placeholder="••••••••" style={S.input} onFocus={e => e.target.style.borderColor = ACCENT} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'} /></div>
        {err && <div style={{ color: '#FCA5A5', fontSize: '0.82rem', padding: '10px', background: 'rgba(239,68,68,0.06)', borderRadius: 8, fontWeight: 500 }}>{err}</div>}
        <button type="submit" disabled={ld} style={{ ...S.primaryBtn, padding: '13px', fontSize: '0.92rem', width: '100%', marginTop: 2, justifyContent: 'center', opacity: ld ? 0.6 : 1 }}>{ld ? 'Ingresando...' : 'Ingresar'}</button>
        <p style={{ textAlign: 'center', color: MUTED, fontSize: '0.74rem', marginTop: 6 }}>Acceso exclusivo</p>
      </form>
    </div>
  );
}

/* ─── Toast ─── */
function Toast({ msg, onClose }) {
  if (!msg) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', bottom: 28, right: 28, background: `linear-gradient(135deg, #065F46, #047857)`, color: '#D1FAE5', padding: '12px 22px', borderRadius: 10, fontWeight: 600, fontSize: '0.84rem', zIndex: 9999, cursor: 'pointer', boxShadow: '0 10px 28px rgba(0,0,0,0.4)', animation: 'scaleIn 0.2s ease-out', display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><polyline points="20,6 9,17 4,12"/></svg>
      {msg}
    </div>
  );
}

/* ─── Skeleton ─── */
function Skeleton({ w = '100%', h = 20 }) {
  return <div style={{ ...S.skeleton, width: w, height: h }} />;
}

/* ─── Main ─── */
export default function AdminPage() {
  const [token, setToken] = useState(() => localStorage.getItem('admin_token') || '');
  const [tab, setTab] = useState('dashboard');
  const [toast, setToast] = useState('');
  const [authorized] = useState(() => isAdminAuthorized());

  if (!authorized) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: BG, color: TEXT, gap: 20, padding: 20, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(239,68,68,0.15)' }}>
          <svg width="28" height="28" fill="none" stroke="#EF4444" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
        </div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>Acceso Restringido</h2>
        <p style={{ color: MUTED, fontSize: '0.86rem', maxWidth: 380, lineHeight: 1.5 }}>Solo la cuenta de administrador puede acceder. Inicia sesion en la pagina principal primero.</p>
        <button onClick={() => window.location.href = '/'} style={{ ...S.primaryBtn, padding: '10px 28px', fontSize: '0.9rem', justifyContent: 'center' }}>Ir al inicio</button>
      </div>
    );
  }

  if (!token) return <LoginScreen onLogin={t => { setToken(t); localStorage.setItem('admin_token', t); }} />;

  const s = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>
      <header style={{ padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${BORDER}`, background: 'rgba(11,17,32,0.85)', backdropFilter: 'blur(24px)', flexShrink: 0, minHeight: 56, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: `linear-gradient(135deg, ${ACCENT}, #0F8A7D)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(20,187,166,0.2)' }}>
              <svg width="15" height="15" fill="none" stroke="#fff" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
            </div>
            <h1 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#F1F5F9', margin: 0, letterSpacing: '-0.1px' }}>Admin</h1>
          </div>
          <nav style={{ display: 'flex', gap: 1 }}>
            {[
              { key: 'dashboard', label: 'Dashboard', icon: <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg> },
              { key: 'businesses', label: 'Negocios', icon: <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
              { key: 'activity', label: 'Actividad', icon: <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg> },
              { key: 'audit', label: 'Auditoria', icon: <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
              { key: 'insights', label: 'Insights', icon: <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M2 12h4l3 8 4-16 3 8h4"/></svg> },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={S.btn(tab === t.key)}>
                {t.icon} {t.label}
              </button>
            ))}
          </nav>
        </div>
        <button onClick={() => { setToken(''); localStorage.removeItem('admin_token'); }} style={S.ghostBtn}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Salir
        </button>
      </header>
      <Toast msg={toast} onClose={() => setToast('')} />
      <main style={{ flex: 1, overflow: 'auto', padding: '28px' }}>
        {tab === 'dashboard' && <Dashboard token={token} />}
        {tab === 'businesses' && <Businesses token={token} toast={s} />}
        {tab === 'activity' && <ActivityFeed token={token} />}
        {tab === 'audit' && <Audit token={token} />}
        {tab === 'insights' && <Insights token={token} />}
      </main>
    </div>
  );
}

/* ─── Dashboard ─── */
function Dashboard({ token }) {
  const [m, setM] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [signups, setSignups] = useState(null);
  const [atRisk, setAtRisk] = useState(null);
  const [bySource, setBySource] = useState(null);

  useEffect(() => {
    fetchAdmin(`${API}/metrics`, token).then(r => r.ok ? r.json() : null).then(d => d && setM(d)).catch(() => {});
    fetchAdmin(`${API}/analytics/revenue`, token).then(r => r.ok ? r.json() : null).then(d => d && setRevenue(d)).catch(() => {});
    fetchAdmin(`${API}/analytics/signups`, token).then(r => r.ok ? r.json() : null).then(d => d && setSignups(d)).catch(() => {});
    fetchAdmin(`${API}/at-risk`, token).then(r => r.ok ? r.json() : null).then(d => d && setAtRisk(d)).catch(() => {});
    fetchAdmin(`${API}/insights`, token).then(r => r.ok ? r.json() : null).then(d => d && setBySource(d.by_source)).catch(() => {});
  }, [token]);

  if (!m) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
      {Array.from({length: 6}).map((_, i) => <div key={i} style={{...S.card, height: 110}}><Skeleton h={14} w="60%"/><Skeleton h={28} w="40%" /><Skeleton h={10} w="30%" /></div>)}
    </div>
  );
  const total = m.total_businesses || 1;

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>Resumen general</h2>
        <span style={{ color: MUTED, fontSize: '0.78rem' }}>Actualizado {fmtTime(new Date().toISOString())}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard color="#3B82F6" label="Total Negocios" value={fmtNum(m.total_businesses)} sub={`${m.active_subscriptions} activos`} />
        <StatCard color="#10B981" label="MRR Mensual" value={fmtPesos(m.mrr)} sub="Ingresos recurrentes" />
        <StatCard color={m.suspended > 0 ? '#EF4444' : '#10B981'} label="Suspendidos" value={fmtNum(m.suspended)} sub={`${m.churn_this_month} churn 30d`} />
        <StatCard color="#F59E0B" label="Conversion" value={`${m.trial_conversions}%`} sub="Trial a pago" />
        <StatCard color="#8B5CF6" label="Ventas Totales" value={fmtNum(m.total_sales ?? m.top_features_used?.[0]?.count ?? 0)} sub="Transacciones" />
        <StatCard color="#EC4899" label="Productos" value={fmtNum(m.total_products)} sub="En todos los negocios" />
      </div>

      {m.activation_funnel && (
        <div style={{ ...S.card, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ color: '#94A3B8', fontSize: '0.7rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.7px' }}>Embudo de activación</h3>
            <span style={{ ...S.pill(m.activation_funnel.activation_rate >= 50 ? '#10B981' : '#F59E0B') }}>{m.activation_funnel.activation_rate}% activados</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {[
              { label: 'Cargaron productos', value: m.activation_funnel.with_products, color: '#3B82F6' },
              { label: 'Abrieron caja', value: m.activation_funnel.opened_register, color: '#F59E0B' },
              { label: 'Hicieron ≥1 venta', value: m.activation_funnel.activated, color: '#10B981' },
            ].map((s, i) => {
              const pct = Math.round((s.value / total) * 100);
              return (
                <div key={i} style={{ background: 'rgba(255,255,255,0.012)', borderRadius: 12, padding: '16px', border: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{fmtNum(s.value)}</div>
                  <div style={{ color: '#94A3B8', fontSize: '0.74rem', fontWeight: 600, marginTop: 5 }}>{s.label}</div>
                  <div style={{ marginTop: 8, height: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: s.color, borderRadius: 2, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ color: MUTED, fontSize: '0.66rem', marginTop: 4 }}>{pct}% de los negocios</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {bySource && (
        <div style={{ marginBottom: 24 }}>
          <DistribCard title="Canal de origen" subtitle="De dónde llegan los registros (se completa con las altas nuevas)" rows={bySource} />
        </div>
      )}

      {atRisk && (atRisk.expiring?.length > 0 || atRisk.inactive?.length > 0) && (
        <div style={{ ...S.card, marginBottom: 24, border: '1px solid rgba(245,158,11,0.15)', background: 'linear-gradient(135deg, #0B1120, rgba(245,158,11,0.03))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <svg width="16" height="16" fill="none" stroke="#F59E0B" viewBox="0 0 24 24" strokeWidth="2.2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <h3 style={{ color: '#F59E0B', fontSize: '0.78rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Atención requerida</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <div>
              <div style={{ color: MUTED, fontSize: '0.72rem', fontWeight: 600, marginBottom: 8 }}>⏰ Prueba/plan por vencer ({atRisk.expiring.length})</div>
              {atRisk.expiring.length === 0 ? <div style={{ color: MUTED, fontSize: '0.78rem', opacity: 0.6 }}>Ninguno</div> :
                atRisk.expiring.slice(0, 5).map(b => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <span style={{ color: TEXT, fontSize: '0.8rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{b.business_name}</span>
                    <span style={{ ...S.pill(b.days_left <= 1 ? '#EF4444' : '#F59E0B'), fontSize: '0.66rem' }}>{b.days_left <= 0 ? 'Hoy' : `${b.days_left}d`}</span>
                  </div>
                ))}
            </div>
            <div>
              <div style={{ color: MUTED, fontSize: '0.72rem', fontWeight: 600, marginBottom: 8 }}>💤 Inactivos (sin ventas 14d) ({atRisk.inactive.length})</div>
              {atRisk.inactive.length === 0 ? <div style={{ color: MUTED, fontSize: '0.78rem', opacity: 0.6 }}>Ninguno</div> :
                atRisk.inactive.slice(0, 5).map(b => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <span style={{ color: TEXT, fontSize: '0.8rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{b.business_name}</span>
                    <span style={{ color: MUTED, fontSize: '0.7rem' }}>{b.last_sale ? fmtDate(b.last_sale) : 'Nunca'}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={S.card}>
          <h3 style={{ color: '#94A3B8', fontSize: '0.7rem', fontWeight: 700, margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Signups (30 dias)</h3>
          {signups && <BarChart data={signups} color="#3B82F6" height={120} />}
        </div>
        <div style={S.card}>
          <h3 style={{ color: '#94A3B8', fontSize: '0.7rem', fontWeight: 700, margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Ventas por mes (12m)</h3>
          {revenue && <BarChart data={revenue.map(r => ({ count: r.sales }))} color="#14BBA6" height={120} />}
        </div>
      </div>

      <div style={S.card}>
        <h3 style={{ color: '#94A3B8', fontSize: '0.7rem', fontWeight: 700, margin: '0 0 18px 0', textTransform: 'uppercase', letterSpacing: '0.7px' }}>Distribucion por plan</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
          {Object.entries(m.breakdown_by_plan || {}).map(([plan, count]) => {
            const pct = Math.round(count / total * 100);
            const c = PLAN[plan]?.color || '#fff';
            return (
              <div key={plan} style={{ background: 'rgba(255,255,255,0.012)', borderRadius: 12, padding: '18px 16px', textAlign: 'center', border: `1px solid ${BORDER}`, transition: 'all 0.2s' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: c, letterSpacing: '-0.3px' }}>{count}</div>
                <div style={{ color: '#94A3B8', fontSize: '0.76rem', fontWeight: 600, marginTop: 3 }}>{PLAN[plan]?.label || plan}</div>
                <div style={{ marginTop: 10, height: 4, background: 'rgba(255,255,255,0.03)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: c, borderRadius: 2, transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ color: MUTED, fontSize: '0.68rem', marginTop: 5 }}>{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ color, label, value, sub }) {
  return (
    <div style={S.statCard(color)}>
      <div style={{ position: 'absolute', top: -15, right: -15, width: 60, height: 60, borderRadius: '50%', background: `${color}06`, pointerEvents: 'none' }} />
      <div style={{ color: MUTED, fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#F1F5F9', letterSpacing: '-0.3px', lineHeight: 1, marginBottom: 2 }}>{value}</div>
      {sub && <div style={{ color: MUTED, fontSize: '0.72rem', fontWeight: 500 }}>{sub}</div>}
    </div>
  );
}

/* ─── Activity Feed ─── */
function ActivityFeed({ token }) {
  const [events, setEvents] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    const load = () => fetchAdmin(`${API}/analytics/activity`, token)
      .then(r => r.ok ? r.json() : [])
      .then(d => setEvents(Array.isArray(d) ? d : []))
      .catch(() => setEvents([]));
    load();
    if (!autoRefresh) return;
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [token, autoRefresh]);

  const typeConfig = {
    sale: { color: '#10B981', icon: '●', label: 'Venta' },
    signup: { color: '#3B82F6', icon: '+', label: 'Registro' },
    admin: { color: '#F59E0B', icon: '⚙', label: 'Admin' },
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>Actividad en tiempo real</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: MUTED, fontSize: '0.72rem' }}>Auto-refresh cada 30s</span>
          <button onClick={() => setAutoRefresh(!autoRefresh)} style={{ ...S.ghostBtn, background: autoRefresh ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.02)', color: autoRefresh ? '#10B981' : MUTED, border: `1px solid ${autoRefresh ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)'}`, padding: '4px 10px', fontSize: '0.7rem' }}>
            {autoRefresh ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
      {!events ? (
        <div style={{ ...S.card, textAlign: 'center', padding: 48 }}>
          <Skeleton h={14} w="30%" /><div style={{height:8}} /><Skeleton h={14} w="50%" /><div style={{height:8}} /><Skeleton h={14} w="40%" />
        </div>
      ) : events.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: 70, color: MUTED }}>
          <div style={{ fontSize: '3rem', marginBottom: 14, opacity: 0.5 }}>⏳</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>Sin actividad reciente</div>
          <div style={{ fontSize: '0.78rem', marginTop: 4 }}>Los eventos apareceran aqui cuando haya ventas, registros o cambios</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 8 }}>
          {events.map((e, i) => {
            const tc = typeConfig[e.type] || typeConfig.sale;
            return (
              <div key={i} style={{ ...S.card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: `3px solid ${tc.color}`, transition: 'all 0.15s' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${tc.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${tc.color}20` }}>
                  <span style={{ fontSize: '0.9rem' }}>{tc.icon}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#E2E8F0', fontSize: '0.84rem', fontWeight: 500, lineHeight: 1.3, wordBreak: 'break-word' }}>{e.msg}</div>
                  <div style={{ color: MUTED, fontSize: '0.68rem', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{fmtDate(e.time)}</span>
                    <span>·</span>
                    <span>{fmtTime(e.time)}</span>
                  </div>
                </div>
                <span style={{ ...S.pill(tc.color), fontSize: '0.66rem', flexShrink: 0 }}>{tc.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Businesses ─── */
function Businesses({ token, toast }) {
  const [data, setData] = useState(null); const [search, setSearch] = useState('');
  const [page, setPage] = useState(1); const [sFilter, setSFilter] = useState(''); const [pFilter, setPFilter] = useState('');
  const [detail, setDetail] = useState(null); const [del, setDel] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    const q = new URLSearchParams({ page, limit: 15 }); if (search) q.set('search', search); if (sFilter) q.set('status', sFilter); if (pFilter) q.set('plan', pFilter);
    const r = await fetchAdmin(`${API}/businesses?${q}`, token); if (r.ok) setData(await r.json());
  };
  useEffect(() => { load(); }, [page, sFilter, pFilter]);

  const doSearch = e => { e.preventDefault(); setPage(1); load(); };
  const chPlan = async (id, np) => { if (!window.confirm(`Cambiar plan a ${PLAN[np]?.label || np}?`)) return; const r = await fetchAdmin(`${API}/businesses/${id}/plan`, token, { method: 'PUT', body: JSON.stringify({ new_plan: np, notes: 'Actualizacion manual' }) }); if (r.ok) { toast('Plan actualizado'); load(); } };
  const chStatus = async (id, ns) => { const r = await fetchAdmin(`${API}/businesses/${id}/status`, token, { method: 'PUT', body: JSON.stringify({ status: ns, reason: 'Accion administrativa' }) }); if (r.ok) { toast('Estado actualizado'); load(); } };
  const extendPlan = async (id, days) => { const r = await fetchAdmin(`${API}/businesses/${id}/extend`, token, { method: 'POST', body: JSON.stringify({ days, notes: `Extensión manual +${days}d` }) }); if (r.ok) { const d = await r.json(); toast(`+${days} días concedidos`); setDetail(null); load(); } else toast('Error al extender'); };
  const doDelete = async (id, name) => {
    if (!window.confirm(`Eliminar "${name}"?\n\nBorra todos los datos: productos, ventas, operadores, config. No se puede deshacer.`)) return;
    setDel(id); const r = await fetchAdmin(`${API}/businesses/${id}`, token, { method: 'DELETE' }); setDel(null);
    if (r.ok) { toast('Negocio eliminado'); load(); } else toast('Error al eliminar');
  };
  const showDetail = async id => { const r = await fetchAdmin(`${API}/businesses/${id}`, token); if (r.ok) setDetail(await r.json()); };
  const handleExport = async () => {
    setExporting(true);
    try {
      const q = new URLSearchParams({ page: 1, limit: 10000 }); if (sFilter) q.set('status', sFilter); if (pFilter) q.set('plan', pFilter);
      const r = await fetchAdmin(`${API}/businesses?${q}`, token);
      if (r.ok) {
        const d = await r.json();
        const csv = ['Nombre,Email,Plan,Estado,Creado,Operadores'].concat(
          (d.data || []).map(b => `"${b.business_name}","${b.email}","${b.plan}","${b.status}","${fmtDate(b.created_at)}",${b.operators_count}`)
        ).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `negocios_${new Date().toISOString().slice(0,10)}.csv`; a.click();
        toast('Exportado');
      }
    } catch { toast('Error al exportar'); }
    setExporting(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>Negocios {data ? `(${data.total})` : ''}</h2>
        <button onClick={handleExport} disabled={exporting} style={S.ghostBtn}>{exporting ? 'Exportando...' : 'Exportar CSV'}</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <form onSubmit={doSearch} style={{ display: 'flex', gap: 8, flex: 1 }}>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nombre o email..." style={{ ...S.input, maxWidth: 280 }} onFocus={e => e.target.style.borderColor = ACCENT} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'} />
          <button type="submit" style={S.primaryBtn}>Buscar</button>
        </form>
        <select value={sFilter} onChange={e => { setSFilter(e.target.value); setPage(1); }} style={S.select}><option value="">Estado</option><option value="active">Activo</option><option value="suspended">Suspendido</option><option value="expired">Expirado</option><option value="past_due">En Mora</option></select>
        <select value={pFilter} onChange={e => { setPFilter(e.target.value); setPage(1); }} style={S.select}><option value="">Plan</option><option value="trial">Trial</option><option value="simple">Simple</option><option value="pro">Pro</option><option value="ia">IA</option></select>
      </div>

      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <thead>
            <tr>
              <th style={S.tableTh}>Negocio</th>
              <th style={{...S.tableTh, textAlign:'center'}}>Plan</th>
              <th style={{...S.tableTh, textAlign:'center'}}>Estado</th>
              <th style={{...S.tableTh, textAlign:'center'}}>WhatsApp</th>
              <th style={{...S.tableTh, textAlign:'center'}}>Desde</th>
              <th style={{...S.tableTh, textAlign:'center'}}>Ops</th>
              <th style={{...S.tableTh, textAlign:'center'}}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map(biz => (
              <tr key={biz.id} style={{ transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(20,187,166,0.025)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={S.tableTd}><div style={{ fontWeight: 600, color: TEXT }}>{biz.business_name}</div><div style={{ color: MUTED, fontSize: '0.76rem', marginTop: 1 }}>{biz.email}</div></td>
                <td style={{...S.tableTd, textAlign:'center'}}>
                  <select value={biz.plan} onChange={e => chPlan(biz.id, e.target.value)} style={{ padding: '4px 8px', borderRadius: 5, border: `1px solid ${PLAN[biz.plan]?.color || '#666'}20`, fontWeight: 600, fontSize: '0.76rem', cursor: 'pointer', background: `${PLAN[biz.plan]?.color || '#666'}0A`, color: PLAN[biz.plan]?.color || '#fff', outline: 'none' }}>
                    <option value="trial">Trial</option><option value="simple">Simple</option><option value="pro">Pro</option><option value="ia">IA</option></select>
                </td>
                <td style={{...S.tableTd, textAlign:'center'}}>
                  <select value={biz.status} onChange={e => chStatus(biz.id, e.target.value)} style={{ padding: '4px 8px', borderRadius: 5, border: `1px solid ${STATUS[biz.status]?.color || '#666'}20`, fontWeight: 600, fontSize: '0.76rem', cursor: 'pointer', background: `${STATUS[biz.status]?.color || '#666'}0A`, color: STATUS[biz.status]?.color || '#fff', outline: 'none' }}>
                    <option value="active">Activo</option><option value="suspended">Suspendido</option><option value="expired">Expirado</option><option value="past_due">En Mora</option></select>
                </td>
                <td style={{...S.tableTd, textAlign:'center'}}>
                  {biz.phone ? (
                    <a href={`https://wa.me/${biz.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" title={`Escribir a ${biz.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 6, fontSize: '0.74rem', fontWeight: 600, color: '#25D366', background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)', textDecoration: 'none', transition: 'all 0.12s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,211,102,0.16)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(37,211,102,0.08)'}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Escribir
                    </a>
                  ) : <span style={{ color: MUTED, fontSize: '0.74rem' }}>—</span>}
                </td>
                <td style={{...S.tableTd, textAlign:'center', color: MUTED, fontSize: '0.8rem'}}>{fmtDate(biz.created_at)}</td>
                <td style={{...S.tableTd, textAlign:'center', color: ACCENT, fontWeight: 700, fontSize: '0.86rem'}}>{biz.operators_count}</td>
                <td style={{...S.tableTd, textAlign:'center'}}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                    <button onClick={() => showDetail(biz.id)} style={{ ...S.ghostBtn, padding: '5px 10px', fontSize: '0.74rem', color: '#60A5FA', background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.15)' }}>Ver</button>
                    <button onClick={() => doDelete(biz.id, biz.business_name)} disabled={del === biz.id} style={{ ...S.ghostBtn, padding: '5px 10px', fontSize: '0.74rem', color: '#EF4444', background: 'rgba(239,68,68,0.04)', borderColor: 'rgba(239,68,68,0.1)', opacity: del ? 0.4 : 1 }}>{del === biz.id ? '...' : 'Eliminar'}</button>
                  </div>
                </td>
              </tr>
            ))}
            {(!data?.data || data.data.length === 0) && <tr><td colSpan={7} style={{ padding: 50, textAlign: 'center', color: MUTED, fontSize: '0.88rem' }}>Sin resultados</td></tr>}
          </tbody>
        </table>
      </div>

      {data && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: MUTED, fontSize: '0.82rem' }}>{data.total} negocios</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ ...S.ghostBtn, opacity: page <= 1 ? 0.3 : 1 }}>Anterior</button>
            <span style={{ color: MUTED, fontSize: '0.8rem' }}>Pag. {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={!data || data.data.length < data.limit} style={{ ...S.ghostBtn, opacity: (!data || data.data.length < data.limit) ? 0.3 : 1 }}>Siguiente</button>
          </div>
        </div>
      )}

      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={() => setDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: 460, background: CARD, border: `1px solid rgba(20,187,166,0.12)`, borderRadius: 16, padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(20,187,166,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(20,187,166,0.15)' }}>
                <svg width="18" height="18" fill="none" stroke={ACCENT} viewBox="0 0 24 24" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
              </div>
              <div><h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{detail.business_name}</h2><span style={{ color: MUTED, fontSize: '0.8rem' }}>{detail.owner_name ? `${detail.owner_name} · ` : ''}{detail.email}</span></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[['Plan','plan','plan'],['Estado','status','status'],['WhatsApp','phone','phone'],['Productos','products_count'],['Ventas','sales_count'],['Operadores','operators_count'],['Creado','created_at','date'],['Ultima venta','last_sale','date']].map(([l,k,t]) => (
                <div key={k} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.01)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.025)' }}>
                  <div style={{ color: MUTED, fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{l}</div>
                  <div style={{ color: TEXT, fontWeight: 600, fontSize: '0.86rem' }}>
                    {t === 'plan' ? <span style={S.pill(PLAN[detail[k]]?.color || '#666')}>{PLAN[detail[k]]?.label || detail[k]}</span> :
                     t === 'status' ? <span style={S.pill(STATUS[detail[k]]?.color || '#666')}>{STATUS[detail[k]]?.label || detail[k]}</span> :
                     t === 'phone' ? (detail[k] ? <a href={`https://wa.me/${detail[k].replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: '#25D366', textDecoration: 'none', fontWeight: 600 }}>{detail[k]}</a> : '—') :
                     t === 'date' ? fmtDate(detail[k]) : detail[k] || '—'}
                  </div>
                </div>
              ))}
            </div>
            {(detail.business_type || detail.objective || detail.needs_arca || detail.prior_pos || detail.source) && (
              <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(96,165,250,0.04)', borderRadius: 10, border: '1px solid rgba(96,165,250,0.12)' }}>
                <div style={{ color: '#94A3B8', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Qué dijo en el onboarding</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[['Rubro', detail.business_type], ['Quiere resolver', detail.objective], ['Facturación', detail.needs_arca], ['Experiencia previa', detail.prior_pos], ['Cómo llegó', detail.source]].filter(([, v]) => v).map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.8rem' }}>
                      <span style={{ color: MUTED, flexShrink: 0 }}>{l}</span>
                      <span style={{ color: TEXT, fontWeight: 600, textAlign: 'right' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(20,187,166,0.03)', borderRadius: 10, border: '1px solid rgba(20,187,166,0.1)' }}>
              <div style={{ color: '#94A3B8', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Extender prueba / plan</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[7, 15, 30].map(d => (
                  <button key={d} onClick={() => extendPlan(detail.id, d)} style={{ ...S.ghostBtn, flex: 1, justifyContent: 'center', color: ACCENT, background: 'rgba(20,187,166,0.06)', borderColor: 'rgba(20,187,166,0.18)', fontWeight: 700 }}>+{d} días</button>
                ))}
              </div>
            </div>
            <button onClick={() => setDetail(null)} style={{ ...S.primaryBtn, width: '100%', marginTop: 12, justifyContent: 'center', padding: '11px' }}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}


/* ─── Insights del Onboarding ─── */
function DistribCard({ title, subtitle, rows }) {
  const total = (rows || []).reduce((s, r) => s + (r.count || 0), 0) || 1;
  const colors = ['#14BBA6', '#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4'];
  return (
    <div style={S.card}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{title}</h3>
        {subtitle && <p style={{ color: MUTED, fontSize: '0.76rem', margin: '3px 0 0' }}>{subtitle}</p>}
      </div>
      {(!rows || rows.length === 0) ? (
        <div style={{ color: MUTED, fontSize: '0.82rem', padding: '20px 0', textAlign: 'center' }}>Sin datos todavía</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {rows.map((r, i) => {
            const pct = Math.round((r.count / total) * 100);
            const isEmpty = r.label === 'Sin completar';
            const color = isEmpty ? MUTED : colors[i % colors.length];
            return (
              <div key={r.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.82rem' }}>
                  <span style={{ color: isEmpty ? MUTED : TEXT, fontWeight: 600, fontStyle: isEmpty ? 'italic' : 'normal' }}>{r.label}</span>
                  <span style={{ color: MUTED, fontWeight: 600 }}>{r.count} · {pct}%</span>
                </div>
                <div style={{ height: 7, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.4s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Insights({ token }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchAdmin(`${API}/insights`, token);
        if (res.ok && alive) setData(await res.json());
      } catch {}
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [token]);

  if (loading) return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>{Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ ...S.card, height: 200 }} />)}</div>;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>Qué quieren los negocios</h2>
        <p style={{ color: MUTED, fontSize: '0.82rem', margin: '4px 0 0' }}>Basado en lo que completan las personas durante el onboarding.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
        <DistribCard title="Rubros" subtitle="Tipo de negocio que abren" rows={data?.by_type} />
        <DistribCard title="Qué buscan resolver" subtitle="Su objetivo principal" rows={data?.by_objective} />
        <DistribCard title="Necesidad de facturar" subtitle="¿Necesitan ARCA / AFIP?" rows={data?.by_arca} />
        <DistribCard title="Experiencia previa" subtitle="¿Usaron un sistema antes?" rows={data?.by_prior_pos} />
        <DistribCard title="Canal de origen" subtitle="De dónde llegaron al registrarse" rows={data?.by_source} />
      </div>
    </div>
  );
}


/* ─── Audit ─── */
function Audit({ token }) {
  const [logs, setLogs] = useState([]);
  const [days, setDays] = useState(60);
  useEffect(() => {
    fetchAdmin(`${API}/audit-log?days=${days}`, token)
      .then(r => r.ok ? r.json() : [])
      .then(d => setLogs(Array.isArray(d) ? d : []))
      .catch(() => setLogs([]));
  }, [token, days]);

  const getActionBadge = (action) => {
    const a = action || '';
    if (a.includes('plan')) return <span style={S.pill('#F59E0B')}>Plan</span>;
    if (a.includes('status')) return <span style={S.pill('#3B82F6')}>Estado</span>;
    return <span style={S.pill(ACCENT)}>{a || '—'}</span>;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#F1F5F9', margin: 0 }}>Registro de auditoria</h2>
        <select value={days} onChange={e => setDays(Number(e.target.value))} style={S.select}>
          <option value={7}>7 dias</option><option value={30}>30 dias</option><option value={60}>60 dias</option><option value={365}>1 ano</option>
        </select>
      </div>
      <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
        {logs.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: MUTED }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: '0.9rem' }}>Sin actividad registrada en este periodo</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr>
                <th style={S.tableTh}>Fecha</th>
                <th style={S.tableTh}>Admin</th>
                <th style={S.tableTh}>Negocio</th>
                <th style={S.tableTh}>Accion</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} style={{ transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{...S.tableTd, color: MUTED, fontSize: '0.8rem', whiteSpace: 'nowrap'}}>{fmtDate(l.timestamp)} {fmtTime(l.timestamp)}</td>
                  <td style={{...S.tableTd, color: '#94A3B8'}}>{l.superadmin_email || '—'}</td>
                  <td style={{...S.tableTd, color: TEXT, fontWeight: 500}}>{l.business_name || l.business_id?.slice(0, 8)}</td>
                  <td style={S.tableTd}>{getActionBadge(l.action)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
