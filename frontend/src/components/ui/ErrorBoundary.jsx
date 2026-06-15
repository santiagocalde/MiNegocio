import React from 'react';
import { Icons } from './Icons';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', padding: 40, textAlign: 'center', background: 'var(--bg-main)',
        }}>
          <div style={{ fontSize: '4rem', marginBottom: 16, color: 'var(--accent-danger)' }}>
            <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
            Algo salió mal
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: '0 0 24px 0', maxWidth: 400 }}>
            Ocurrió un error inesperado al cargar esta sección. No se perdieron datos.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={this.handleReset}
              style={{
                background: 'var(--gradient-primary)', color: 'white', border: 'none',
                padding: '12px 32px', borderRadius: 10, fontWeight: 700, fontSize: '1rem',
                cursor: 'pointer',
              }}>
              Reintentar
            </button>
            <button onClick={() => window.location.href = '/panel/ventas'}
              style={{
                background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)',
                padding: '12px 32px', borderRadius: 10, fontWeight: 700, fontSize: '1rem',
                cursor: 'pointer',
              }}>
              Volver al inicio
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
