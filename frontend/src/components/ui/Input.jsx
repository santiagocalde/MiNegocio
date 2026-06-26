/**
 * Input — primitiva de campo de texto del tema Ocean Dark.
 *
 * Props:
 *   label:  texto opcional arriba del campo
 *   error:  mensaje de error opcional (pinta el borde de rojo y lo muestra debajo)
 *   block:  bool — ocupa todo el ancho (default true)
 *   ...resto de props nativas de <input> (value, onChange, type, placeholder…)
 */
export default function Input({
  label,
  error,
  block = true,
  style = {},
  id,
  ...rest
}) {
  const inputId = id || (label ? `in-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return (
    <div style={{ width: block ? '100%' : undefined, display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label htmlFor={inputId} style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...rest}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '9px 12px',
          fontSize: '0.9rem',
          color: 'var(--text-primary)',
          background: 'var(--bg-card)',
          border: `1px solid ${error ? 'var(--accent-danger)' : 'var(--border-color)'}`,
          borderRadius: '8px',
          outline: 'none',
          transition: 'border-color 0.12s',
          ...style,
        }}
      />
      {error && (
        <span style={{ fontSize: '0.78rem', color: 'var(--accent-danger)' }}>{error}</span>
      )}
    </div>
  );
}
