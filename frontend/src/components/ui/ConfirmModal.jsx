export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', variant = 'danger', loading }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '32px', width: '400px', maxWidth: '90vw', boxShadow: '0 10px 25px rgba(30,58,95,0.5)' }}>
        <div style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '16px' }}>
          {variant === 'danger' ? '⚠️' : variant === 'warning' ? '⚡' : 'ℹ️'}
        </div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text-primary)', textAlign: 'center' }}>
          {title || '¿Estás seguro?'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', textAlign: 'center', margin: '0 0 24px 0', lineHeight: '1.5' }}>
          {message || 'Esta acción no se puede deshacer.'}
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button onClick={onClose} disabled={loading} style={{
            background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
            padding: '10px 20px', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600,
          }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={loading} style={{
            background: variant === 'danger' ? 'var(--accent-danger)' : 'var(--accent-primary)',
            border: 'none', color: 'white', padding: '10px 20px', borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: loading ? 0.6 : 1,
          }}>
            {loading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}