import { useState, useEffect, useCallback } from 'react';

/**
 * Toggle de tema del sistema interno (claro/oscuro).
 * Aplica `data-panel-theme` en <html> y lo persiste en localStorage.
 * Default: 'dark' (comportamiento histórico del sistema).
 *
 * Es self-contained a propósito: no threadea props por medio panel. La fuente
 * de verdad es localStorage['panel_theme'] + el atributo en documentElement.
 */
export function applyPanelTheme(theme) {
  try { document.documentElement.setAttribute('data-panel-theme', theme); } catch { /* noop */ }
}

export function getInitialPanelTheme() {
  try { return localStorage.getItem('panel_theme') || 'dark'; } catch { return 'dark'; }
}

const Sun = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);
const Moon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

export default function ThemeToggle({ collapsed }) {
  const [theme, setTheme] = useState(getInitialPanelTheme);

  useEffect(() => {
    applyPanelTheme(theme);
    try { localStorage.setItem('panel_theme', theme); } catch { /* noop */ }
  }, [theme]);

  const toggle = useCallback(() => setTheme(t => (t === 'dark' ? 'light' : 'dark')), []);

  const isDark = theme === 'dark';
  const label = isDark ? 'Modo claro' : 'Modo oscuro';

  return (
    <button
      onClick={toggle}
      title={label}
      aria-label={label}
      style={{
        width: '100%',
        background: 'var(--surface-veil)',
        border: '1px solid var(--border-color)',
        color: 'var(--text-secondary)',
        padding: collapsed ? '11px 0' : '7px 10px',
        borderRadius: 8,
        fontWeight: 700,
        cursor: 'pointer',
        fontSize: '0.75rem',
        transition: 'background 0.2s, color 0.2s, border-color 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
      onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-primary)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
    >
      {isDark ? <Sun /> : <Moon />}
      {!collapsed && <span className="btn-label">{label}</span>}
    </button>
  );
}
