import React from 'react';
import { apiPost } from '../../services/apiClient';

function BackupRestoreModal({ showBackupRestore, setShowBackupRestore, backupList, restoring, setRestoring, addToast }) {
  if (!showBackupRestore) return null;
  return (
    <div className="modal-overlay" onClick={() => setShowBackupRestore(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <h2 className="modal-title" style={{ fontSize: '1.5rem', color: 'var(--accent-danger)' }}>⚠️ Restaurar Backup</h2>
        <div style={{ background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid var(--accent-danger)', padding: '16px', borderRadius: '4px', marginBottom: '16px', fontSize: '0.9rem' }}>
          <strong>¡ATENCIÓN! SOLO USAR EN CASO DE EMERGENCIA</strong>
          <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>Restaurar reemplaza TODOS LOS DATOS. Se perderán ventas, productos y configuraciones posteriores a la copia.</p>
        </div>
        {backupList.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '24px' }}>No hay copias disponibles.</p> : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {backupList.map(b => <div key={b.filename} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', background:'var(--bg-main)', borderRadius:'8px', marginBottom:'8px' }}>
              <div><div style={{ fontWeight:600, fontSize:'0.85rem', fontFamily:'var(--font-mono)' }}>{b.filename}</div><div style={{ color:'var(--text-secondary)', fontSize:'0.8rem' }}>{b.modified} — {b.size_kb} KB</div></div>
              <button disabled={restoring} onClick={async () => {
                if (!window.confirm(`¿Restaurar "${b.filename}"? Se perderán los datos actuales.`)) return;
                setRestoring(true);
                try { const res = await apiPost('/backup/restore', { filename: b.filename }); if (res.ok) { addToast('✅ Base de datos restaurada. Se recomienda reiniciar.', 'success'); setShowBackupRestore(false); } else { const err = await res.json().catch(()=>({})); addToast(err.detail||'No se pudo restaurar el backup. Reintentá o probá con otro archivo.','error'); } }
                catch { addToast('No se pudo conectar con el servidor. Revisá tu conexión a internet.','error'); }
                setRestoring(false);
              }} style={{ background:'var(--accent-danger)', border:'none', borderRadius:'8px', color:'white', padding:'8px 16px', cursor:'pointer', fontWeight:700, fontSize:'0.85rem', opacity: restoring?0.6:1 }}>{restoring?'Restaurando...':'Restaurar'}</button>
            </div>)}
          </div>
        )}
        <div className="modal-actions" style={{ marginTop: '16px' }}><button className="btn btn-modal-confirm" onClick={() => setShowBackupRestore(false)}>Cerrar</button></div>
      </div>
    </div>
  );
}

export default BackupRestoreModal;
