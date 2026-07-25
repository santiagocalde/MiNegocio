import { useState } from 'react';

/**
 * Pide el PIN de un administrador/encargado para autorizar una acción sensible
 * (anular venta / devolver ítem). El PIN se valida en el backend contra los
 * operadores con rol admin o manager. onConfirm(pin) debe devolver una promesa
 * que resuelve a true si la acción se autorizó, o false si el PIN fue rechazado.
 *
 * Se monta sólo cuando hace falta (el padre lo renderiza condicionalmente), así
 * cada apertura arranca con estado limpio sin necesidad de un efecto de reset.
 */
export default function SupervisorPinModal({ onClose, onConfirm, title = 'Autorización requerida' }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!/^\d{4}$/.test(pin)) { setError('El PIN son 4 dígitos'); return; }
    setBusy(true);
    const ok = await onConfirm(pin);
    setBusy(false);
    if (ok === false) { setError('PIN incorrecto o sin permisos'); setPin(''); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '360px' }}>
        <h2 className="modal-title" style={{ color: 'var(--accent-danger)' }}>{title}</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>
          Anular o devolver una venta requiere el PIN de un administrador o encargado.
        </p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          maxLength={4}
          value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="••••"
          style={{
            width: '100%', textAlign: 'center', letterSpacing: '10px', fontSize: '1.6rem',
            padding: '12px', background: 'var(--bg-main)', border: '1px solid var(--border-color)',
            color: 'var(--text-primary)', borderRadius: '8px', fontFamily: 'var(--font-mono)', outline: 'none',
          }}
        />
        {error && <p style={{ color: 'var(--accent-danger)', textAlign: 'center', marginTop: '8px', fontSize: '0.8rem' }}>{error}</p>}
        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <button className="btn btn-modal-cancel" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn btn-modal-confirm" style={{ background: 'var(--accent-danger)' }} onClick={submit} disabled={busy}>
            {busy ? 'Verificando…' : 'Autorizar'}
          </button>
        </div>
      </div>
    </div>
  );
}
