import { useState } from 'react';
import useModalExit from '../../hooks/useModalExit';

/**
 * HelpButton — el clásico signo de pregunta circular "¿Cómo se usa?".
 *
 * Se pone al lado del título de cada módulo. Al tocarlo abre un modal que
 * explica, punto por punto, cómo se usa ese módulo. Usa las clases compartidas
 * .modal-overlay/.modal-content, así hereda la animación y el bloqueo de scroll.
 *
 * Props:
 *   title  — nombre del módulo (ej. "Proveedores"). Arma el encabezado.
 *   intro  — párrafo corto opcional que explica para qué sirve el módulo.
 *   steps  — array de pasos. Cada paso puede ser un string o { title, desc }.
 *   size   — diámetro del botón en px (default 22).
 */
export default function HelpButton({ title, intro, steps = [], size = 22 }) {
  const [open, setOpen] = useState(false);
  const { rendered, closing } = useModalExit(open);

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="¿Cómo se usa?"
        aria-label={`¿Cómo se usa ${title}?`}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: size, height: size, borderRadius: '50%',
          border: '1.5px solid var(--accent-primary)', background: 'transparent',
          color: 'var(--accent-primary)', fontWeight: 800, fontSize: `${size * 0.62}px`,
          lineHeight: 1, cursor: 'pointer', flexShrink: 0, padding: 0,
          fontFamily: 'var(--font-main)', transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--sheet, #fff)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--accent-primary)'; }}
      >
        ?
      </button>

      {rendered && (
        <div className={`modal-overlay${closing ? ' closing' : ''}`} onClick={() => setOpen(false)}>
          <div className={`modal-content${closing ? ' closing' : ''}`} onClick={e => e.stopPropagation()} style={{ maxWidth: 540, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: intro ? 8 : 16 }}>
              <span style={{ flexShrink: 0, width: 34, height: 34, borderRadius: '50%', background: 'var(--wash-primary, rgba(20,187,166,0.12))', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', border: '1.5px solid var(--accent-primary)' }}>?</span>
              <h2 className="modal-title" style={{ margin: 0, textAlign: 'left', fontSize: '1.3rem' }}>¿Cómo se usa {title}?</h2>
            </div>

            {intro && <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.5, margin: '0 0 18px' }}>{intro}</p>}

            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {steps.map((s, i) => {
                const st = typeof s === 'string' ? { desc: s } : s;
                return (
                  <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-primary)', color: 'var(--sheet, #fff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', marginTop: 1 }}>{i + 1}</span>
                    <div style={{ minWidth: 0 }}>
                      {st.title && <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: 2 }}>{st.title}</div>}
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>{st.desc}</div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="modal-actions" style={{ marginTop: 22 }}>
              <button className="btn btn-modal-confirm" style={{ background: 'var(--accent-primary)', width: '100%' }} onClick={() => setOpen(false)}>Entendido</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
