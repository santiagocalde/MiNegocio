import React from 'react';
import { apiPut } from '../../services/apiClient';
import * as QZTray from '../../services/qzTray';

export default function ConfigPrinting({ printConfig, setPrintConfig, qzConnected, setQzConnected, addToast }) {
  return (
    <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', margin: '16px 40px' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        🖨️ Impresión y Cajón Fiscal
        <span style={{ fontSize: '0.75rem', marginLeft: '12px', padding: '2px 8px', borderRadius: '8px', background: qzConnected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: qzConnected ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
          QZ Tray: {qzConnected ? 'Conectado' : 'No disponible'}
        </span>
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
          <input type="checkbox" checked={printConfig.enabled} onChange={e => setPrintConfig({...printConfig, enabled: e.target.checked})} />
          Habilitar impresión automática
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
          <input type="checkbox" checked={printConfig.auto_open_drawer} onChange={e => setPrintConfig({...printConfig, auto_open_drawer: e.target.checked})} />
          Abrir cajón al cobrar en efectivo
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
          <input type="checkbox" checked={printConfig.auto_print_ticket} onChange={e => setPrintConfig({...printConfig, auto_print_ticket: e.target.checked})} />
          Imprimir ticket automáticamente
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
          <span>Modo:</span>
          <select value={printConfig.mode} onChange={e => setPrintConfig({...printConfig, mode: e.target.value})} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '6px', outline: 'none' }}>
            <option value="window_print">window.print()</option>
            <option value="qz_tray">QZ Tray</option>
            <option value="agent">Agente Python</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
          <span>Impresora:</span>
          <input type="text" value={printConfig.printer_name} onChange={e => setPrintConfig({...printConfig, printer_name: e.target.value})} placeholder="Nombre de impresora (opcional)" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '6px', outline: 'none' }} />
        </div>
      </div>
      <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
        <button onClick={async () => {
          try {
            await apiPut('/config/printing', printConfig);
            addToast('Configuración de impresión guardada', 'success');
          } catch { addToast('No se pudo guardar la configuración de impresión. Reintentá.', 'error'); }
        }} style={{ background: 'var(--gradient-primary)', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
          Guardar Configuración
        </button>
        <button onClick={async () => {
          try {
            await QZTray.connectQZTray(5000);
            setQzConnected(true);
            addToast('QZ Tray conectado', 'success');
          } catch {
            setQzConnected(false);
            addToast('No se detectó el servicio de impresión (QZ Tray). Abrilo en tu PC e intentá de nuevo.', 'error');
          }
        }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '10px 20px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
          Probar Conexión QZ Tray
        </button>
        <button onClick={async () => {
          try {
            await QZTray.openCashDrawer(printConfig.printer_name);
            addToast('Cajón abierto', 'success');
          } catch (e) {
            try {
              await QZTray.openDrawerViaAgent('http://127.0.0.1:8199', printConfig.printer_name);
              addToast('Cajón abierto (vía agente)', 'success');
            } catch {
              addToast('No se pudo abrir el cajón. Revisá que esté conectado e intentá de nuevo.', 'error');
            }
          }
        }} style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--accent-success)', padding: '10px 20px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
          Probar Cajón
        </button>
      </div>
    </div>
  );
}
