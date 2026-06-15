import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from '../pages/LandingPage';
import LandingNav from '../pages/landing/LandingNav';
import LandingHero from '../pages/landing/LandingHero';

// Mock IntersectionObserver
class MockObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = MockObserver;

// Mock images
vi.mock('../assets/images/MiNegocio_transparente_real.png', () => ({ default: 'logo.png' }));
vi.mock('../assets/images/mascota_oficial.jpg', () => ({ default: 'mascota.jpg' }));
vi.mock('../assets/images/whatsapp_logo.png', () => ({ default: 'wp.png' }));
vi.mock('../assets/images/mercadopago_logo.png', () => ({ default: 'mp.png' }));

describe('LandingPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders hero section with CTA buttons', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/Seguís usando/)).toBeDefined();
    expect(screen.getByText('Probar Gratis 7 Días')).toBeDefined();
    expect(screen.getByText('Ver Planes')).toBeDefined();
  });

  it('renders all major sections', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    expect(screen.getByText(/más rápido/)).toBeDefined();
    expect(screen.getByText('Confían en MiNegocio')).toBeDefined();
    expect(screen.getByText('Planes simples, sin letra chica')).toBeDefined();
    expect(screen.getByText('Preguntas frecuentes')).toBeDefined();
  });

  it('shows login modal when clicking Iniciar Sesión', async () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    const loginBtn = screen.getByText('Iniciar Sesión');
    fireEvent.click(loginBtn);
    await waitFor(() => {
      expect(screen.getByText('Bienvenido')).toBeDefined();
    });
  });

  it('shows contact modal when clicking Contacto in nav', async () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    const contactoLink = screen.getAllByText('Contacto')[0];
    fireEvent.click(contactoLink);
    await waitFor(() => {
      expect(screen.getByText('Escribinos')).toBeDefined();
    });
  });

  it('shows register button and navigates', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    expect(screen.getByText('Registrarse')).toBeDefined();
  });

  it('closes modals with Escape key', async () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('Iniciar Sesión'));
    await waitFor(() => expect(screen.getByText('Bienvenido')).toBeDefined());
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByText('Bienvenido')).toBeNull();
    });
  });

  it('shows Ver Planes button in hero', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    expect(screen.getByText('Ver Planes')).toBeDefined();
  });
});

describe('LandingNav', () => {
  const defaultProps = {
    isScrolled: false, isLoggedIn: false, userName: '', showUserMenu: false,
    setShowUserMenu: vi.fn(), mobileMenu: false, setMobileMenu: vi.fn(),
    setIsLoggedIn: vi.fn(), setShowLoginModal: vi.fn(), goPanel: vi.fn(),
    goOnboard: vi.fn(), navigate: vi.fn(), setShowContactModal: vi.fn(),
    logoImg: 'logo.png', activeSection: '',
  };

  it('renders logo and nav links', () => {
    render(
      <MemoryRouter>
        <LandingNav {...defaultProps} />
      </MemoryRouter>
    );
    expect(screen.getByAltText('MiNegocio')).toBeDefined();
    expect(screen.getByText('Funciones')).toBeDefined();
    expect(screen.getByText('Planes')).toBeDefined();
  });

  it('shows login and register when not logged in', () => {
    render(
      <MemoryRouter>
        <LandingNav {...defaultProps} />
      </MemoryRouter>
    );
    expect(screen.getByText('Iniciar Sesión')).toBeDefined();
    expect(screen.getByText('Registrarse')).toBeDefined();
  });

  it('shows Ir al Panel when logged in', () => {
    render(
      <MemoryRouter>
        <LandingNav {...defaultProps} isLoggedIn={true} userName="Carlos" />
      </MemoryRouter>
    );
    expect(screen.getByText('Ir al Panel')).toBeDefined();
    expect(screen.queryByText('Iniciar Sesión')).toBeNull();
  });

  it('highlights active section', () => {
    const { container } = render(
      <MemoryRouter>
        <LandingNav {...defaultProps} activeSection="planes" />
      </MemoryRouter>
    );
    const links = container.querySelectorAll('.lp-nav-link');
    const planesLink = Array.from(links).find(l => l.textContent === 'Planes');
    expect(planesLink?.className).toContain('lp-nav-link--active');
  });
});

describe('LandingHero', () => {
  it('shows Probar Gratis when not logged in', () => {
    render(
      <MemoryRouter>
        <LandingHero isLoggedIn={false} goPanel={vi.fn()} goOnboard={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText('Probar Gratis 7 Días')).toBeDefined();
  });

  it('shows Ir a mi Panel when logged in', () => {
    render(
      <MemoryRouter>
        <LandingHero isLoggedIn={true} goPanel={vi.fn()} goOnboard={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText('Ir a mi Panel')).toBeDefined();
  });

  it('renders scroll indicator', () => {
    const { container } = render(
      <MemoryRouter>
        <LandingHero isLoggedIn={false} goPanel={vi.fn()} goOnboard={vi.fn()} />
      </MemoryRouter>
    );
    expect(container.querySelector('.scroll-indicator')).toBeDefined();
    expect(screen.getByText('Scroll')).toBeDefined();
  });
});
