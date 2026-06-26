import { useState, useRef } from 'react';
import { API_ROOT } from '../../config';
import { Icons } from './shared';

/**
 * Modal del escáner de facturas con IA. Extraído de PurchasesModule sin cambios
 * de comportamiento. Sube una imagen a /api/ai/scan-invoice (plan IA) y devuelve
 * los items detectados vía onScanSuccess.
 */
export default function AIScannerModal({ onClose, onScanSuccess }) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const fileRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    setScanError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      // scan-invoice exige plan IA → hay que mandar el token. NO seteamos
      // Content-Type: el browser pone el boundary correcto del multipart.
      const token = localStorage.getItem('saas_token');
      const res = await fetch(`${API_ROOT}/api/ai/scan-invoice`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al analizar la factura');
      }
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        const mapped = data.items.map(item => ({
          product_id: item.product_id || 0,
          product_name: item.product_name || item.name || 'Producto detectado',
          quantity: item.quantity || 1,
          unit_cost: item.unit_cost || item.cost || 0,
        }));
        onScanSuccess(mapped);
      } else {
        setScanError('No se detectaron productos en la imagen. Intenta con otra foto.');
      }
    } catch (err) {
      setScanError(err.message || 'Error al conectar con el servidor');
    }
    setIsScanning(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(11, 19, 43, 0.8)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
       <div style={{ background: 'var(--bg-main)', border: '1px solid rgba(20, 187, 166, 0.3)', borderRadius: '24px', width: '600px', maxWidth: '90vw', padding: '40px', position: 'relative', boxShadow: '0 24px 48px rgba(0,0,0,0.5)' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '24px', right: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '50%', width: '32px', height: '32px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.X /></button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ background: 'rgba(20, 187, 166, 0.15)', color: 'var(--accent-primary)', padding: '6px 12px', borderRadius: '12px', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icons.Sparkles /> PRO FEATURE
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>Créditos mensuales: <span style={{ color: 'var(--text-primary)' }}>45/50</span></span>
          </div>

          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Carga de Facturas con IA</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 32px 0', fontSize: '0.95rem' }}>Fotografiá el remito o factura del proveedor. La IA detectará automáticamente los productos, cantidades y costos. El stock se actualizará solo.</p>

          <div
             onClick={() => !isScanning && fileRef.current?.click()}
             style={{ border: `2px dashed ${isScanning ? '#10B981' : scanError ? '#ef4444' : 'rgba(20, 187, 166, 0.5)'}`, borderRadius: '16px', padding: '48px 24px', textAlign: 'center', background: isScanning ? 'rgba(16, 185, 129, 0.05)' : scanError ? 'rgba(239,68,68,0.05)' : 'rgba(20, 187, 166, 0.05)', cursor: isScanning ? 'default' : 'pointer', transition: 'all 0.3s', marginBottom: '32px' }}
          >
             <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
             {isScanning ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: '40px', height: '40px', border: '4px solid rgba(16, 185, 129, 0.3)', borderTopColor: '#10B981', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#10B981' }}>Analizando documento...</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '8px' }}>Extrayendo productos y costos via IA</div>
                </div>
             ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ color: scanError ? 'var(--accent-danger)' : 'var(--accent-primary)', marginBottom: '16px' }}><Icons.Camera /></div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '8px' }}>{scanError ? 'Error al analizar' : 'Hace clic para subir una foto de la factura'}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{scanError || 'Soporta JPG o PNG (Max 5MB)'}</div>
                </div>
             )}
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '1px solid var(--border-color)' }}>
             <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--text-primary)' }}>Para mejores resultados:</h4>
             <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#10B981' }}>✓</span> Buena iluminación, sin sombras oscuras.</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#10B981' }}>✓</span> Todos los márgenes de la hoja visibles.</li>
                <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ color: '#10B981' }}>✓</span> Texto legible, sin desenfoque ni movimiento.</li>
             </ul>
          </div>
          <style>{'@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }'}</style>
       </div>
    </div>
  );
}
