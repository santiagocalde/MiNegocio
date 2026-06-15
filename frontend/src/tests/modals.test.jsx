import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingLoginModal from '../pages/landing/LandingLoginModal';
import LandingContactModal from '../pages/landing/LandingContactModal';
import ForgotPasswordModal from '../pages/landing/ForgotPasswordModal';

class MockObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = MockObserver;

describe('LandingLoginModal', () => {
  const defaultProps = {
    showLoginModal: 'login',
    setShowLoginModal: vi.fn(),
    setShowForgotPassword: vi.fn(),
    loginName: '', setLoginName: vi.fn(),
    loginEmail: '', setLoginEmail: vi.fn(),
    loginPassword: '', setLoginPassword: vi.fn(),
    showPassword: false, setShowPassword: vi.fn(),
    loginLoading: false, loginError: '',
    handleAuthSubmit: vi.fn(), goOnboard: vi.fn(), navigate: vi.fn(),
  };

  it('renders login form', () => {
    render(
      <MemoryRouter>
        <LandingLoginModal {...defaultProps} />
      </MemoryRouter>
    );
    expect(screen.getByText('Bienvenido')).toBeDefined();
    expect(screen.getByText('Entrar a mi cuenta')).toBeDefined();
  });

  it('renders register form', () => {
    render(
      <MemoryRouter>
        <LandingLoginModal {...defaultProps} showLoginModal="register" />
      </MemoryRouter>
    );
    expect(screen.getByText('Creá tu cuenta')).toBeDefined();
    expect(screen.getByText('Crear mi cuenta')).toBeDefined();
    expect(screen.getByPlaceholderText('Ej: Carlos')).toBeDefined();
  });

  it('toggles between login and register', () => {
    const setModal = vi.fn();
    render(
      <MemoryRouter>
        <LandingLoginModal {...defaultProps} setShowLoginModal={setModal} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('registrate gratis'));
    expect(setModal).toHaveBeenCalledWith('register');
  });

  it('shows forgot password on click', () => {
    const setForgot = vi.fn();
    const setModal = vi.fn();
    render(
      <MemoryRouter>
        <LandingLoginModal {...defaultProps} setShowLoginModal={setModal} setShowForgotPassword={setForgot} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('¿Olvidaste tu contraseña?'));
    expect(setModal).toHaveBeenCalledWith(false);
    expect(setForgot).toHaveBeenCalledWith(true);
  });

  it('shows error message', () => {
    render(
      <MemoryRouter>
        <LandingLoginModal {...defaultProps} loginError="Credenciales inválidas" />
      </MemoryRouter>
    );
    expect(screen.getByText('Credenciales inválidas')).toBeDefined();
  });

  it('hides when showLoginModal is false', () => {
    const { container } = render(
      <MemoryRouter>
        <LandingLoginModal {...defaultProps} showLoginModal={false} />
      </MemoryRouter>
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows preview button', () => {
    render(
      <MemoryRouter>
        <LandingLoginModal {...defaultProps} />
      </MemoryRouter>
    );
    expect(screen.getByText('Visualización previa del sistema POS')).toBeDefined();
  });
});

describe('LandingContactModal', () => {
  const defaultProps = {
    showContactModal: true,
    setShowContactModal: vi.fn(),
    contactSent: false, setContactSent: vi.fn(),
    contactLoading: false,
    contactForm: { nombre: '', contacto: '', mensaje: '' },
    setContactForm: vi.fn(),
    handleContactSubmit: vi.fn(),
  };

  it('renders contact form', () => {
    render(
      <MemoryRouter>
        <LandingContactModal {...defaultProps} />
      </MemoryRouter>
    );
    expect(screen.getByText('Escribinos')).toBeDefined();
    expect(screen.getByPlaceholderText('Ej. Juan Pérez')).toBeDefined();
    expect(screen.getByText('Enviar Mensaje')).toBeDefined();
  });

  it('disables submit when fields empty', () => {
    render(
      <MemoryRouter>
        <LandingContactModal {...defaultProps} />
      </MemoryRouter>
    );
    const btn = screen.getByText('Enviar Mensaje');
    expect(btn).toBeDisabled();
  });

  it('shows success message after send', () => {
    render(
      <MemoryRouter>
        <LandingContactModal {...defaultProps} contactSent={true} />
      </MemoryRouter>
    );
    expect(screen.getByText('¡Mensaje enviado!')).toBeDefined();
  });

  it('hides when showContactModal is false', () => {
    const { container } = render(
      <MemoryRouter>
        <LandingContactModal {...defaultProps} showContactModal={false} />
      </MemoryRouter>
    );
    expect(container.innerHTML).toBe('');
  });
});

describe('ForgotPasswordModal', () => {
  it('renders email input', () => {
    render(
      <MemoryRouter>
        <ForgotPasswordModal onClose={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText('Recuperar contraseña')).toBeDefined();
    expect(screen.getByPlaceholderText('nombre@kiosco.com')).toBeDefined();
    expect(screen.getByText('Enviar enlace')).toBeDefined();
  });

  it('shows Volver button', () => {
    render(
      <MemoryRouter>
        <ForgotPasswordModal onClose={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText('Volver al inicio de sesión')).toBeDefined();
  });

  it('calls onClose when clicking Volver', () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <ForgotPasswordModal onClose={onClose} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('Volver al inicio de sesión'));
    expect(onClose).toHaveBeenCalled();
  });
});
