const Icons = {
  Package: () => (
    <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.6 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  Users: () => (
    <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.6 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
    </svg>
  ),
  ShoppingCart: () => (
    <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.6 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  Report: () => (
    <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.6 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Truck: () => (
    <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.6 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 14V6h8v8m-8 0a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zm-8-8h8m0 0l3 3v5h-3m-8-8H4v8h4" />
    </svg>
  ),
  Activity: () => (
    <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ opacity: 0.6 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
};

export default function EmptyState({ icon = 'Package', title, description, actionLabel, actionOnClick }) {
  const IconComponent = Icons[icon] || Icons.Package;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '64px 32px', textAlign: 'center', color: 'var(--text-secondary)',
    }}>
      <div style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
        <IconComponent />
      </div>
      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
        {title || 'Sin datos'}
      </h3>
      <p style={{ fontSize: '0.9rem', margin: '0 0 24px 0', maxWidth: '400px', lineHeight: '1.6' }}>
        {description || 'No hay elementos para mostrar en esta secci&oacute;n.'}
      </p>
      {actionLabel && actionOnClick && (
        <button onClick={actionOnClick} style={{
          background: 'var(--gradient-primary)', color: 'white', border: 'none',
          padding: '10px 20px', borderRadius: '8px', fontWeight: 700, fontSize: '0.9rem',
          cursor: 'pointer',
        }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export { Icons as EmptyStateIcons };