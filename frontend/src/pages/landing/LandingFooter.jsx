const Svg = {
  ArrowUp: () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>,
  Wifi: () => <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12.55a11 11 0 0114.08 0M1.42 9a16 16 0 0121.16 0M8.53 16.11a6 6 0 016.95 0M12 20h.01" /></svg>,
};

export default function LandingFooter({ navigate, setShowContactModal, handleDogClick, logoImg, mascotaImg }) {
  const goFaq = () => document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // Columnas de navegación. `to` puede ser: ancla (#id), ruta (/x), o acción (fn).
  const columns = [
    {
      title: 'Producto',
      links: [
        { label: 'Funciones', href: '#funciones' },
        { label: 'El sistema por dentro', href: '#sistema' },
        { label: 'Precios', href: '#planes' },
        { label: 'Probar gratis', onClick: () => navigate('/register') },
      ],
    },
    {
      title: 'Recursos',
      links: [
        { label: 'Blog', href: '/blog/' },
        { label: 'Glosario', href: '/glosario/' },
        { label: 'Sistema sin internet', href: '/pos-sin-internet/' },
        { label: 'Control de fiados', href: '/sistema-fiados/' },
        { label: 'Comparar sistemas', href: '/comparar-sistemas-para-kioscos/' },
        { label: 'Centro de soporte', onClick: () => navigate('/soporte') },
      ],
    },
    {
      title: 'Por rubro',
      links: [
        { label: 'Kioscos y almacenes', href: '/software-kiosco/' },
        { label: 'Vinerias', href: '/software-vineria/' },
        { label: 'Almacenes', href: '/software-almacen/' },
        { label: 'Ferreterias', href: '/software-ferreteria/' },
        { label: 'Dieteticas', href: '/software-dietetica/' },
        { label: 'Corralones de materiales', href: '/software-corralon-materiales/' },
      ],
    },
    {
      title: 'Por ciudad',
      links: [
        { label: 'Buenos Aires', href: '/pos-buenos-aires/' },
        { label: 'Rosario', href: '/pos-rosario/' },
        { label: 'Cordoba', href: '/pos-cordoba/' },
        { label: 'Mar del Plata', href: '/pos-mar-del-plata/' },
        { label: 'Mendoza', href: '/pos-mendoza/' },
      ],
    },
    {
      title: 'Empresa',
      links: [
        { label: 'Sobre nosotros', onClick: () => navigate('/nosotros') },
        { label: 'Contacto', onClick: () => setShowContactModal(true) },
        { label: 'Términos y condiciones', onClick: () => navigate('/terminos') },
        { label: 'Política de privacidad', onClick: () => navigate('/privacidad') },
      ],
    },
  ];

  const renderLink = (l) => {
    if (l.href) return <a key={l.label} href={l.href} className="ftr-link">{l.label}</a>;
    return (
      <span key={l.label} role="button" tabIndex={0} className="ftr-link"
        onClick={l.onClick} onKeyDown={(e) => { if (e.key === 'Enter') l.onClick(); }}>
        {l.label}
      </span>
    );
  };

  return (
    <footer className="ftr" role="contentinfo">
      <style>{`
        .ftr {
          position: relative; z-index: 10;
          background: var(--lp-paper-sunken);
          border-top: 1px solid var(--lp-line);
          padding: 56px 24px 28px;
        }
        .ftr-inner { max-width: 1280px; margin: 0 auto; }
        .ftr-grid {
          display: grid;
          grid-template-columns: 1.3fr 1fr 1fr 1fr 1fr 1fr;
          gap: 32px;
        }
        /* ── Columna de marca ── */
        .ftr-brand { max-width: 340px; }
        .ftr-logo { height: 60px; object-fit: contain; transform: scale(1.25); transform-origin: left center; margin-bottom: 18px; cursor: pointer; }
        .ftr-tagline {
          font-family: var(--lp-font-body);
          font-size: 0.95rem; line-height: 1.6; color: var(--lp-ink-soft);
          margin: 0 0 22px;
        }
        .ftr-offline {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 0.8rem; font-weight: 600; color: var(--lp-primary-ink);
          background: var(--lp-primary-wash); border: 1px solid var(--lp-line);
          padding: 7px 12px; border-radius: 999px; margin-bottom: 20px;
        }
        /* Sello de la mascota — discreto, profesional */
        .ftr-seal {
          display: flex; align-items: center; gap: 11px;
          padding: 10px 12px; border-radius: 14px;
          background: var(--lp-paper-raised); border: 1px solid var(--lp-line);
          width: fit-content;
        }
        .ftr-seal img {
          width: 40px; height: 40px; border-radius: 50%; object-fit: cover;
          border: 2px solid var(--lp-line-strong); cursor: pointer; transition: transform 0.3s;
        }
        .ftr-seal img:hover { transform: scale(1.08) rotate(3deg); }
        .ftr-seal-txt { display: flex; flex-direction: column; line-height: 1.25; }
        .ftr-seal-txt b { font-size: 0.8rem; color: var(--lp-ink); font-weight: 700; }
        .ftr-seal-txt span { font-size: 0.72rem; color: var(--lp-ink-faint); }

        /* ── Columnas de links ── */
        .ftr-col-title {
          font-family: var(--lp-font-mono);
          font-size: 0.72rem; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--lp-ink-faint); margin-bottom: 16px;
        }
        .ftr-col { display: flex; flex-direction: column; gap: 12px; }
        .ftr-link {
          font-size: 0.9rem; color: var(--lp-ink-soft); text-decoration: none;
          cursor: pointer; transition: color 0.18s; width: fit-content;
        }
        .ftr-link:hover { color: var(--lp-primary-ink); }

        /* ── Barra inferior ── */
        .ftr-rule { height: 1px; background: var(--lp-line); border: none; margin: 44px 0 22px; }
        .ftr-bottom {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 14px;
        }
        .ftr-copy { font-size: 0.82rem; color: var(--lp-ink-faint); }
        .ftr-top-btn {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 0.8rem; font-weight: 600; color: var(--lp-ink-soft);
          background: var(--lp-paper-raised); border: 1px solid var(--lp-line);
          padding: 8px 14px; border-radius: 10px; cursor: pointer; transition: color 0.18s, border-color 0.18s;
        }
        .ftr-top-btn:hover { color: var(--lp-primary-ink); border-color: var(--lp-primary); }

        @media (max-width: 860px) {
          .ftr-grid { grid-template-columns: 1fr 1fr; gap: 36px 24px; }
          .ftr-brand { grid-column: 1 / -1; max-width: 100%; }
        }
        @media (max-width: 520px) {
          .ftr { padding: 44px 20px 24px; }
          .ftr-grid { grid-template-columns: 1fr; gap: 30px; }
          .ftr-bottom { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <div className="ftr-inner">
        <div className="ftr-grid">
          {/* Marca */}
          <div className="ftr-brand">
            <img src={logoImg} alt="MiNegocio" loading="lazy" className="ftr-logo" onClick={scrollTop} />
            <p className="ftr-tagline">
              El punto de venta hecho para los comercios de Argentina. Vendé, controlá el stock y manejá los fiados desde una sola pantalla.
            </p>
            <div className="ftr-offline"><Svg.Wifi /> Funciona sin internet</div>
            <div className="ftr-seal">
              <img onClick={handleDogClick} src={mascotaImg} alt="Perrito Guardián, mascota de MiNegocio" loading="lazy" />
              <div className="ftr-seal-txt">
                <b>Oficial de Seguridad 🐾</b>
                <span>Tus datos, siempre cuidados</span>
              </div>
            </div>
          </div>

          {/* Columnas de navegación */}
          {columns.map((col) => (
            <nav key={col.title} className="ftr-col" aria-label={col.title}>
              <div className="ftr-col-title">{col.title}</div>
              {col.links.map(renderLink)}
            </nav>
          ))}
        </div>

        <hr className="ftr-rule" />

        <div className="ftr-bottom">
          <span className="ftr-copy">© 2026 MiNegocio · Hecho en Argentina 🇦🇷</span>
          <button className="ftr-top-btn" onClick={scrollTop} aria-label="Volver arriba">
            Volver arriba <Svg.ArrowUp />
          </button>
        </div>
      </div>
    </footer>
  );
}
