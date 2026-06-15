import React from 'react';

export default function ToastContainer({ toasts }) {
  return (
    <div role="alert" aria-live="polite" style={{ position:'fixed', top:'24px', right:'24px', display:'flex', flexDirection:'column', gap:'12px', zIndex:9999, pointerEvents:'none', maxWidth:'500px' }}>
      {toasts.map(t => (
        <div key={t.id} style={{ background: t.type==='success'?'var(--accent-success)':(t.type==='error'?'var(--accent-danger)':'var(--bg-card)'), color:'white', padding:'20px 32px', borderRadius:'12px', boxShadow:'0 10px 25px rgba(30,58,95,0.5)', fontWeight:700, fontSize:'1.25rem', animation:'slideInRight 0.3s ease', pointerEvents:'auto' }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
