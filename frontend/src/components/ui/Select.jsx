/**
 * Select — primitiva de desplegable del tema Ocean Dark.
 *
 * Props:
 *   label:   texto opcional arriba del campo
 *   options: [{ value, label }] — alternativa a pasar <option> como children
 *   block:   bool — ocupa todo el ancho (default true)
 *   ...resto de props nativas de <select> (value, onChange…)
 */
export default function Select({
  label,
  options,
  block = true,
  style = {},
  id,
  children,
  ...rest
}) {
  const selId = id || (label ? `sel-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return (
    <div style={{ width: block ? '100%' : undefined, display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label htmlFor={selId} style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}
      <select
        id={selId}
        {...rest}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '9px 12px',
          fontSize: '0.9rem',
          color: 'var(--text-primary)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          outline: 'none',
          cursor: 'pointer',
          ...style,
        }}
      >
        {options
          ? options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))
          : children}
      </select>
    </div>
  );
}
