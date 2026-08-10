import { useEffect } from 'react';

const csvData = {
  productos: {
    filename: 'articulos_corralon.csv',
    content: 'nombre;precio_venta;codigo;precio_costo;unidad;categoria;stock_actual\nArena fina x bolsa;3500;ARN-001;2800;bolsa;Áridos;120\nLadrillo común;180;LAD-001;130;unidad;Ladrillos;5000\nCemento Portland 50kg;8900;CEM-001;7200;bolsa;Cementos;80\nHierro 8mm x barra;4200;HIE-008;3500;barra;Hierros;200\n;;;;;;',
  },
  clientes: {
    filename: 'clientes_corralon.csv',
    content: 'nombre;telefono;direccion;dni_cuit;email;saldo_deuda\nJuan Pérez;3512345678;Rivadavia 456 Córdoba;28456789;;0\nConstrucciones López;3519876543;Av. Colón 1200;20-23456789-5;info@lopez.com;45000\nMaría González;3515678901;Los Ceibos 89;;;0\n;;;;;',
  },
  proveedores: {
    filename: 'proveedores_corralon.csv',
    content: 'nombre;telefono;email;cuit;contacto\nDistribuidora Sur;3511112222;ventas@sur.com;30-71234567-4;Carlos Méndez\nCerámicos del Norte;3513334444;;30-68987654-1;\nHierros Rossi;3515556666;rossi@hierros.com;;Juan Rossi\n;;;;',
  },
};

function downloadCSV(type) {
  const { filename, content } = csvData[type];
  const bom = '﻿';
  const encoded = encodeURIComponent(bom + content);
  const a = document.createElement('a');
  a.href = 'data:text/csv;charset=utf-8,' + encoded;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

const S = {
  page: { maxWidth: 780, margin: '0 auto', padding: '32px 16px 64px', fontFamily: 'system-ui, sans-serif', color: '#0f172a' },
  header: { marginBottom: 36, paddingBottom: 24, borderBottom: '2px solid #e2e8f0' },
  eyebrow: { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#14BBA6', marginBottom: 6 },
  h1: { fontSize: '1.8rem', fontWeight: 800, lineHeight: 1.2 },
  sub: { marginTop: 8, color: '#475569', fontSize: '0.95rem' },
  steps: { display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap', alignItems: 'center' },
  stepNum: { width: 22, height: 22, borderRadius: '50%', background: '#14BBA6', color: '#fff', fontSize: '0.7rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  stepSep: { color: '#94a3b8', fontSize: '0.7rem' },
  stepTxt: { fontSize: '0.82rem', color: '#475569', display: 'flex', alignItems: 'center' },
  sectionLabel: { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 12, marginTop: 32 },
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '22px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 16 },
  cardHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' },
  cardTitle: { fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 },
  pills: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  pill: { fontSize: '0.75rem', padding: '3px 10px', borderRadius: 20, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569' },
  pillReq: { fontSize: '0.75rem', padding: '3px 10px', borderRadius: 20, background: 'rgba(20,187,166,0.1)', border: '1px solid #14BBA6', color: '#14BBA6', fontWeight: 600 },
  legend: { display: 'flex', gap: 14, fontSize: '0.72rem', color: '#94a3b8', marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' },
  note: { fontSize: '0.8rem', color: '#475569', padding: '10px 14px', borderLeft: '3px solid #e2e8f0', background: '#f8fafc', borderRadius: '0 6px 6px 0', marginBottom: 10 },
  btn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#14BBA6', color: '#fff', border: 'none', borderRadius: 7, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.02em' },
  tableWrap: { overflowX: 'auto', marginBottom: 14 },
  arcaCard: { background: 'rgba(217,119,6,0.08)', border: '1.5px solid #d97706', borderRadius: 10, padding: '22px 24px', marginBottom: 16 },
  arcaTitle: { fontSize: '1.05rem', fontWeight: 700, color: '#d97706', marginBottom: 4 },
  arcaSub: { fontSize: '0.82rem', color: '#475569', marginBottom: 16 },
  footerNote: { marginTop: 36, padding: '16px 20px', background: 'rgba(22,163,74,0.08)', border: '1px solid #16a34a', borderRadius: 8, fontSize: '0.82rem', color: '#475569' },
};

const tableStyle = `
  .cc-table { width:100%; border-collapse:collapse; font-size:0.78rem; white-space:nowrap }
  .cc-table th { text-align:left; padding:5px 10px; background:#f8fafc; border:1px solid #e2e8f0; font-size:0.68rem; font-weight:700; text-transform:uppercase; color:#475569 }
  .cc-table td { padding:5px 10px; border:1px solid #e2e8f0; color:#475569 }
  .cc-check { width:18px; height:18px; border:2px solid #d97706; border-radius:4px; flex-shrink:0; margin-top:2px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.75rem; color:#d97706; user-select:none }
  .cc-check.on { background:#d97706; color:#fff }
`;

export default function CargaCorralonPage() {
  useEffect(() => { document.title = 'Carga de datos — Corralón · MiNegocio'; }, []);

  function toggleCheck(e) {
    e.currentTarget.classList.toggle('on');
    e.currentTarget.textContent = e.currentTarget.classList.contains('on') ? '✓' : '';
  }

  return (
    <>
      <style>{tableStyle}</style>
      <div style={S.page}>
        {/* Header */}
        <div style={S.header}>
          <div style={S.eyebrow}>MiNegocio · Carga inicial</div>
          <h1 style={S.h1}>Plantillas de datos para el Corralón</h1>
          <p style={S.sub}>Completá cada archivo con los datos del negocio. Cuanto más completo, mejor arranca el sistema.</p>
        </div>

        {/* Steps */}
        <div style={S.steps}>
          {[['1','Bajá las plantillas'],['2','Completá en Excel/Sheets'],['3','Guardá como CSV'],['4','Mandáselo a Santi']].map(([n, txt], i, arr) => (
            <span key={n} style={{ display:'flex', alignItems:'center', gap: i < arr.length-1 ? 12 : 0 }}>
              <span style={S.stepTxt}><span style={S.stepNum}>{n}</span>{txt}</span>
              {i < arr.length-1 && <span style={S.stepSep}>→</span>}
            </span>
          ))}
        </div>

        {/* Productos */}
        <div style={S.sectionLabel}>📦 Artículos / Productos</div>
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div style={S.cardTitle}><span>🧱</span> Artículos del corralón</div>
            <button style={S.btn} onClick={() => downloadCSV('productos')}>⬇ Bajar plantilla</button>
          </div>
          <div style={S.legend}>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:8, borderRadius:'50%', background:'#14BBA6', display:'inline-block' }}></span> Obligatorio</span>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}><span style={{ width:8, height:8, borderRadius:'50%', background:'#94a3b8', display:'inline-block' }}></span> Opcional</span>
          </div>
          <div style={S.pills}>
            {['nombre *','precio_venta *'].map(p => <span key={p} style={S.pillReq}>{p}</span>)}
            {['codigo','precio_costo','unidad','categoria','stock_actual'].map(p => <span key={p} style={S.pill}>{p}</span>)}
          </div>
          <div style={S.tableWrap}>
            <table className="cc-table">
              <thead><tr><th>nombre</th><th>precio_venta</th><th>codigo</th><th>precio_costo</th><th>unidad</th><th>categoria</th><th>stock_actual</th></tr></thead>
              <tbody>
                <tr><td>Arena fina x bolsa</td><td>3500</td><td>ARN-001</td><td>2800</td><td>bolsa</td><td>Áridos</td><td>120</td></tr>
                <tr><td>Ladrillo común</td><td>180</td><td>LAD-001</td><td>130</td><td>unidad</td><td>Ladrillos</td><td>5000</td></tr>
                <tr><td>Cemento Portland 50kg</td><td>8900</td><td>CEM-001</td><td>7200</td><td>bolsa</td><td>Cementos</td><td>80</td></tr>
                <tr><td>Hierro 8mm x barra</td><td>4200</td><td>HIE-008</td><td>3500</td><td>barra</td><td>Hierros</td><td>200</td></tr>
              </tbody>
            </table>
          </div>
          <div style={S.note}><strong>Unidades típicas del rubro:</strong> bolsa, unidad, kg, m², m³, litro, barra, rollo, caja, metro lineal.<br />Si no tenés código propio, podés dejarlo en blanco — el sistema lo genera automático.</div>
        </div>

        {/* Clientes */}
        <div style={S.sectionLabel}>👥 Clientes</div>
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div style={S.cardTitle}><span>🏠</span> Clientes del corralón</div>
            <button style={S.btn} onClick={() => downloadCSV('clientes')}>⬇ Bajar plantilla</button>
          </div>
          <div style={S.pills}>
            <span style={S.pillReq}>nombre *</span>
            {['telefono','direccion','dni_cuit','email','saldo_deuda'].map(p => <span key={p} style={S.pill}>{p}</span>)}
          </div>
          <div style={S.tableWrap}>
            <table className="cc-table">
              <thead><tr><th>nombre</th><th>telefono</th><th>direccion</th><th>dni_cuit</th><th>email</th><th>saldo_deuda</th></tr></thead>
              <tbody>
                <tr><td>Juan Pérez</td><td>3512345678</td><td>Rivadavia 456 Córdoba</td><td>28456789</td><td></td><td>0</td></tr>
                <tr><td>Construcciones López</td><td>3519876543</td><td>Av. Colón 1200</td><td>20-23456789-5</td><td>info@lopez.com</td><td>45000</td></tr>
                <tr><td>María González</td><td>3515678901</td><td>Los Ceibos 89</td><td></td><td></td><td>0</td></tr>
              </tbody>
            </table>
          </div>
          <div style={S.note}><strong>saldo_deuda:</strong> Si el cliente ya te debe plata al arrancar, anotá el monto. Si no debe nada, poné 0 o dejalo en blanco.</div>
        </div>

        {/* Proveedores */}
        <div style={S.sectionLabel}>🚚 Proveedores</div>
        <div style={S.card}>
          <div style={S.cardHeader}>
            <div style={S.cardTitle}><span>🏭</span> Proveedores</div>
            <button style={S.btn} onClick={() => downloadCSV('proveedores')}>⬇ Bajar plantilla</button>
          </div>
          <div style={S.pills}>
            <span style={S.pillReq}>nombre *</span>
            {['telefono','email','cuit','contacto'].map(p => <span key={p} style={S.pill}>{p}</span>)}
          </div>
          <div style={S.tableWrap}>
            <table className="cc-table">
              <thead><tr><th>nombre</th><th>telefono</th><th>email</th><th>cuit</th><th>contacto</th></tr></thead>
              <tbody>
                <tr><td>Distribuidora Sur</td><td>3511112222</td><td>ventas@sur.com</td><td>30-71234567-4</td><td>Carlos Méndez</td></tr>
                <tr><td>Cerámicos del Norte</td><td>3513334444</td><td></td><td>30-68987654-1</td><td></td></tr>
                <tr><td>Hierros Rossi</td><td>3515556666</td><td>rossi@hierros.com</td><td></td><td>Juan Rossi</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ARCA */}
        <div style={S.sectionLabel}>🏛 ARCA / AFIP — qué necesitás tener a mano</div>
        <div style={S.arcaCard}>
          <div style={S.arcaTitle}>⚠️ Información fiscal (ARCA)</div>
          <div style={S.arcaSub}>Para emitir facturas desde el sistema, necesitás tener esto disponible. Marcá lo que ya tenés.</div>
          <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:10 }}>
            {[
              ['CUIT del negocio', 'El CUIT a nombre del corralón (no el personal). Ej: 30-71234567-4'],
              ['Clave fiscal nivel 3 en ARCA', 'Necesaria para acceder a los servicios de AFIP/ARCA desde el sistema'],
              ['Régimen impositivo', 'Monotributo (qué categoría) o Responsable Inscripto'],
              ['Punto de venta habilitado en ARCA', 'Si ya tiene facturación electrónica activa, ¿cuál es el número de punto de venta?'],
              ['Certificado digital', 'Archivo .pem o .crt generado desde el panel de AFIP. Si no lo tenés, te ayudamos a generarlo'],
              ['Tipo de comprobante', '¿Factura A, B o C? Depende del régimen y del tipo de cliente'],
            ].map(([title, desc]) => (
              <li key={title} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                <div className="cc-check" onClick={toggleCheck}></div>
                <div>
                  <strong style={{ display:'block', fontSize:'0.88rem', color:'#0f172a' }}>{title}</strong>
                  <span style={{ fontSize:'0.78rem', color:'#475569' }}>{desc}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div style={S.footerNote}>
          <strong style={{ color:'#16a34a' }}>✅ Con los 3 archivos CSV + la info de ARCA, el sistema queda listo para arrancar.</strong><br />
          Si hay artículos que no sabés el precio o el stock exacto, completá lo que tenés y después se ajusta desde el sistema. No hace falta que esté perfecto para empezar.
        </div>
      </div>
    </>
  );
}
