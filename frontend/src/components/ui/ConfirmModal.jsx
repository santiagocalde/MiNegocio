import { Icons } from './Icons';
import useModalExit from '../../hooks/useModalExit';

const VariantIcon = ({ variant }) => {
  const base = { width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', margin: '0 auto 16px' };
  if (variant === 'danger')   return <div style={{ ...base, background: 'var(--wash-danger)',   color: 'var(--accent-danger)'   }}><Icons.Alert /></div>;
  if (variant === 'warning')  return <div style={{ ...base, background: 'var(--wash-warning)', color: 'var(--accent-warning)' }}><Icons.Alert /></div>;
  return                             <div style={{ ...base, background: 'rgba(20,187,166,0.12)', color: 'var(--accent-primary)' }}><Icons.HelpCircle /></div>;
};

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', variant = 'danger', loading }) {
  const { rendered, closing } = useModalExit(isOpen);
  if (!rendered) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(30,58,95,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, animation: `${closing ? 'modalOverlayOut 0.16s ease-in forwards' : 'modalOverlayIn 0.16s ease-out'}`, cursor: 'pointer' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '32px', width: '400px', maxWidth: '90vw', boxShadow: '0 10px 25px rgba(30,58,95,0.5)', animation: `${closing ? 'modalContentOut 0.16s cubic-bezier(0.4, 0, 1, 1) forwards' : 'modalContentIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'}`, cursor: 'default' }}>
        <VariantIcon variant={variant} />
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