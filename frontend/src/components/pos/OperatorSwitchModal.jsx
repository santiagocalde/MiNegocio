import { useState } from 'react';
import { apiPost } from '../../services/apiClient';

/**
 * Elegir / cambiar de operador validando su PIN, SIN abrir ni cerrar turno.
 * Se usa en dos lugares:
 *   - Apertura de caja: quién arranca el turno.
 *   - Cambio de operador en pleno turno (relevo liviano): las ventas siguientes
 *     se estampan con el nuevo nombre; la caja sigue siendo la misma.
 *
 * El PIN es la fuente de verdad: /api/operators/verify-pin devuelve a quién
 * corresponde. El selector es una ayuda para el usuario, pero se valida que el
 * PIN ingresado corresponda a la persona elegida.
 *
 * onConfirm(operator) recibe {id, name, role, permissions} del operador validado.
 * Se monta condicionalmente desde el padre, así arranca siempre con estado limpio.
 */
export default function OperatorSwitchModal({
  operators = [],
  onClose,
  onConfirm,
  title = 'Cambiar de operador',
  subtitle = 'Ingresá tu PIN para registrar quién atiende. La caja sigue abierta.',
  confirmLabel = 'Confirmar',
}) {
  const [selectedId, setSelectedId] = useState(operators.length ? String(operators[0].id) : '');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!/^\d{4}$/.test(pin)) { setError('El PIN son 4 dígitos'); return; }
    setBusy(true);
    try {
      const res = await apiPost('/operators/verify-pin', { pin });
      if (!res.ok) { setError('PIN incorrecto'); setPin(''); setBusy(false); return; }
      const op = await res.json();
      // El PIN manda: si eligió a alguien de la lista, el PIN tiene que ser de esa persona.
      if (selectedId && String(op.id) !== String(selectedId)) {
        setError('Ese PIN no corresponde a la persona elegida');
        setPin('');
        setBusy(false);
        return;
      }
      onConfirm(op);
    } catch {
      setError('Sin conexión. Reintentá.');
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '360px' }}>
        <h2 className="modal-title" style={{ color: 'var(--accent-primary)' }}>{title}</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>
          {subtitle}
        </p>
        {operators.length > 1 && (
          <select
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value); setError(''); }}
            style={{
              width: '100%', padding: '10px 12px', marginBottom: '12px',
              background: 'var(--bg-main)', border: '1px solid var(--border-color)',
              color: 'var(--text-primary)', borderRadius: '8px', fontSize: '1rem', outline: 'none',
            }}
          >
            {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        )}
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
          <button className="btn btn-modal-confirm" onClick={submit} disabled={busy}>
            {busy ? 'Verificando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
