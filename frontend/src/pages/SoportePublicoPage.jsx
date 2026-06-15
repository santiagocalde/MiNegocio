import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Svg = {
  ArrowLeft: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>,
  Search: () => <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Book: () => <svg width="24" height="24" fill="none" stroke="var(--lp-primary)" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>,
  Message: () => <svg width="24" height="24" fill="none" stroke="var(--lp-primary)" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>,
  Play: () => <svg width="24" height="24" fill="none" stroke="var(--lp-primary)" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
};

const whatsappBase = 'https://wa.me/5491144276384';

const cards = [
  {
    icon: Svg.Book, title: 'Manuales de Uso',
    desc: 'Guías paso a paso sobre cómo cargar productos, realizar ventas y configurar tu lector de código de barras.',
    msg: 'Hola!%20Quisiera%20ver%20los%20manuales%20de%20uso%20de%20MiNegocio'
  },
  {
    icon: Svg.Play, title: 'Video Tutoriales',
    desc: 'Aprendé visualmente con nuestra biblioteca de videos cortos que explican todas las funciones del sistema.',
    msg: 'Hola!%20Quisiera%20acceder%20a%20los%20video%20tutoriales%20de%20MiNegocio'
  },
  {
    icon: Svg.Message, title: 'Soporte Técnico',
    desc: '¿Tenés un problema técnico o un error? Abrí un ticket con nuestro equipo y te lo resolvemos rápido.',
    msg: 'Hola!%20Necesito%20soporte%20técnico%20para%20MiNegocio'
  },
];

export default function SoportePublicoPage() {
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('landing-open');
    window.scrollTo(0, 0);
    return () => document.body.classList.remove('landing-open');
  }, []);

  return (
    <div className="lp-noise" style={{ fontFamily: 'var(--lp-font-body)', color: 'var(--lp-text)', minHeight: '100vh', position: 'relative', padding: '40px 24px' }}>
      <div className="lp-canvas" />
      <div className="lp-orb lp-orb--1" />
      <div className="lp-orb lp-orb--2" />

      <div style={{ maxWidth: 800, margin: '0 auto', position: 'relative', zIndex: 10 }}>
        <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'var(--lp-text-muted)', fontSize: '0.9rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32, transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = 'var(--lp-text-muted)'}>
          <Svg.ArrowLeft /> Volver a Inicio
        </button>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-1px', marginBottom: 12, color: '#fff' }}>Centro de Ayuda</h1>
          <p style={{ fontSize: '0.95rem', color: 'rgba(230,255,251,0.7)', maxWidth: 600, margin: '0 auto 24px' }}>
            Encontrá respuestas rápidas, manuales de uso y contactá con nuestro equipo de soporte técnico.
          </p>
          
          <div style={{ position: 'relative', maxWidth: 450, margin: '0 auto' }}>
            <div style={{ position: 'absolute', top: '50%', left: 16, transform: 'translateY(-50%)', color: 'var(--lp-text-muted)' }}>
              <Svg.Search />
            </div>
            <input type="text" placeholder="Buscar manuales, errores, configuraciones..." style={{ width: '100%', padding: '12px 16px 12px 48px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', outline: 'none', fontSize: '0.95rem', transition: 'all 0.2s', boxShadow: '0 8px 30px rgba(30,58,95,0.2)' }} onFocus={e => e.target.style.borderColor = 'var(--lp-primary)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 40 }}>
          {cards.map((card, i) => (
            <div key={i} className="lp-glass" onClick={() => window.open(`${whatsappBase}?text=${card.msg}`, '_blank')} style={{ padding: 24, borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(35,65,105,0.6)', transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(20,187,166,0.1)' }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}>
              <div style={{ width: 40, height: 40, background: 'rgba(20,187,166,0.1)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <card.icon />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: 6 }}>{card.title}</h3>
              <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>{card.desc}</p>
            </div>
          ))}
        </div>

        <div className="lp-glass" style={{ padding: '32px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(35,65,105,0.85)', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: 12 }}>¿No encontraste lo que buscabas?</h2>
          <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.9rem', marginBottom: 24, maxWidth: 500, margin: '0 auto 24px' }}>
            Nuestros operadores técnicos están disponibles por WhatsApp de Lunes a Sábados de 08:00 a 20:00.
          </p>
          <a href="https://wa.me/5491144276384" target="_blank" rel="noopener noreferrer" style={{ padding: '12px 24px', borderRadius: 10, border: 'none', background: '#10b981', color: '#fff', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)', transition: 'all 0.2s', textDecoration: 'none', display: 'inline-block' }} onMouseEnter={e => e.target.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.target.style.transform = 'translateY(0)'}>
            Contactar por WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
