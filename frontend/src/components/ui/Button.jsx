/**
 * Button — primitiva de botón del tema Ocean Dark.
 *
 * Reemplaza los estilos inline repetidos por toda la app. Usa las variables CSS
 * del tema, así un cambio de paleta se refleja en todos lados.
 *
 * Props:
 *   variant: 'primary' | 'secondary' | 'danger' | 'ghost'   (default 'primary')
 *   size:    'sm' | 'md' | 'lg'                              (default 'md')
 *   block:   bool — ocupa todo el ancho
 *   loading: bool — muestra estado cargando y deshabilita
 *   ...resto de props nativas de <button> (onClick, disabled, type, etc.)
 */
const VARIANTS = {
  primary: {
    background: 'var(--gradient-primary, var(--accent-primary))',
    color: '#04121A',
    border: '1px solid transparent',
  },
  secondary: {
    background: 'var(--bg-hover)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
  },
  danger: {
    background: 'rgba(239, 68, 68, 0.15)',
    color: 'var(--accent-danger)',
    border: '1px solid rgba(239, 68, 68, 0.45)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid transparent',
  },
};

const SIZES = {
  sm: { padding: '6px 12px', fontSize: '0.82rem' },
  md: { padding: '9px 16px', fontSize: '0.9rem' },
  lg: { padding: '12px 22px', fontSize: '1rem' },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  disabled = false,
  style = {},
  children,
  ...rest
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.md;
  const isDisabled = disabled || loading;

  return (
    <button
      {...rest}
      disabled={isDisabled}
      style={{
        ...v,
        ...s,
        width: block ? '100%' : undefined,
        borderRadius: '8px',
        fontWeight: 700,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        transition: 'transform 0.12s, opacity 0.12s, box-shadow 0.12s',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {loading ? 'Cargando…' : children}
    </button>
  );
}
