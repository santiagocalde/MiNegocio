import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingSocialProof from '../pages/landing/LandingSocialProof';
import LandingTestimonials from '../pages/landing/LandingTestimonials';
import LandingFAQ from '../pages/landing/LandingFAQ';
import LandingFinalCTA from '../pages/landing/LandingFinalCTA';
import testimonials from '../pages/landing/data/testimonials';

class MockObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = MockObserver;

describe('LandingSocialProof', () => {
  it('renders all metrics', () => {
    render(
      <MemoryRouter>
        <LandingSocialProof />
      </MemoryRouter>
    );
    expect(screen.getByText('Confían en MiNegocio')).toBeDefined();
    expect(screen.getByText('Kioscos activos')).toBeDefined();
    expect(screen.getByText('Ventas procesadas')).toBeDefined();
    expect(screen.getByText('Disponibilidad')).toBeDefined();
    expect(screen.getByText('Puntuación')).toBeDefined();
  });
});

describe('LandingTestimonials', () => {
  it('renders testimonials from data', () => {
    render(
      <MemoryRouter>
        <LandingTestimonials />
      </MemoryRouter>
    );
    expect(screen.getByText(/ya usan MiNegocio/)).toBeDefined();
    testimonials.forEach(t => {
      expect(screen.getByText(t.name)).toBeDefined();
      expect(screen.getByText(t.business)).toBeDefined();
    });
  });

  it('testimonials data is valid', () => {
    expect(testimonials.length).toBeGreaterThanOrEqual(3);
    testimonials.forEach(t => {
      expect(t.id).toBeDefined();
      expect(t.name).toBeTruthy();
      expect(t.text).toBeTruthy();
      expect(t.business).toBeTruthy();
      expect(t.stars).toBeGreaterThanOrEqual(1);
      expect(t.stars).toBeLessThanOrEqual(5);
    });
  });
});

describe('LandingFAQ', () => {
  it('renders all FAQ items', () => {
    render(
      <MemoryRouter>
        <LandingFAQ />
      </MemoryRouter>
    );
    expect(screen.getByText('Preguntas frecuentes')).toBeDefined();
    expect(screen.getByText(/¿Qué es un POS/)).toBeDefined();
    expect(screen.getByText(/¿Es fácil de usar/)).toBeDefined();
    expect(screen.getByText(/¿Necesito internet/)).toBeDefined();
    expect(screen.getByText(/¿Funciona en mi computadora/)).toBeDefined();
    expect(screen.getByText(/¿Cómo son los 7 días/)).toBeDefined();
  });

  it('FAQ items are expandable details elements', () => {
    const { container } = render(
      <MemoryRouter>
        <LandingFAQ />
      </MemoryRouter>
    );
    const details = container.querySelectorAll('details');
    expect(details.length).toBe(5);
  });
});

describe('LandingFinalCTA', () => {
  it('shows CTA for non-logged in', () => {
    render(
      <MemoryRouter>
        <LandingFinalCTA isLoggedIn={false} goPanel={() => {}} goOnboard={() => {}} />
      </MemoryRouter>
    );
    expect(screen.getByText('Empezar 7 días gratis')).toBeDefined();
    expect(screen.getByText(/Dejá de perder plata/)).toBeDefined();
    expect(screen.getByText('Sin tarjeta de crédito')).toBeDefined();
    expect(screen.getByText('Cancelás cuando querés')).toBeDefined();
  });

  it('shows CTA for logged in', () => {
    render(
      <MemoryRouter>
        <LandingFinalCTA isLoggedIn={true} goPanel={() => {}} goOnboard={() => {}} />
      </MemoryRouter>
    );
    expect(screen.getByText('Ir a mi Panel')).toBeDefined();
    expect(screen.getByText('Tu negocio te espera')).toBeDefined();
  });
});
