import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from './Icons';

export default function FeatureGate({ isLocked, requiredPlan, children }) {
  const navigate = useNavigate();

  if (!isLocked) {
    return children;
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={{ filter: 'blur(6px)', opacity: 0.6, pointerEvents: 'none', width: '100%', height: '100%', transition: 'all 0.3s' }}>
        {children}
      </div>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
        <div style={{ background: 'var(--bg-main)', border: '1px solid rgba(20,187,166,0.3)', padding: '40px', borderRadius: '24px', textAlign: 'center', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(20,187,166,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', color: 'var(--accent-primary)' }}>
            <Icons.Lock style={{ width: 32, height: 32 }} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
            Función Exclusiva
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '0.95rem', lineHeight: 1.5 }}>
            Esta pantalla pertenece al plan <strong style={{ color: 'var(--text-primary)' }}>{(requiredPlan || 'Superior').toUpperCase()}</strong>. Actualizá tu plan para desbloquear esta y otras herramientas avanzadas.
          </p>
          <button 
            onClick={() => navigate('/panel/plan')}
            style={{ width: '100%', background: 'var(--gradient-primary)', color: 'white', border: 'none', padding: '16px', borderRadius: '12px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(20,187,166,0.3)' }}
          >
            Ver Planes y Mejorar
          </button>
        </div>
      </div>
    </div>
  );
}
