import { useEffect } from 'react';

export default function PreviewPage() {
  useEffect(() => {
    localStorage.setItem('saas_token', 'preview-token');
    localStorage.setItem('saas_mode', 'preview');
    localStorage.setItem('minegocio_current_operator', 'Vista Previa');
    localStorage.setItem('minegocio_current_turn_id', 'preview-turn');

    window.location.href = '/panel?preview=true';
  }, []);

  return (
    <div className="layout" style={{ justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: 20 }}>
      <div style={{ width: 40, height: 40, border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Cargando vista previa del sistema...</p>
    </div>
  );
}
