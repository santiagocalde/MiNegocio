import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const REPO = '/root/MiNegocio';

describe('PanelContext - code integrity', () => {
  it('has ownerGate state', () => {
    const c = fs.readFileSync(path.join(REPO, 'frontend/src/context/PanelContext.jsx'), 'utf8');
    expect(c).toContain('ownerGate');
    expect(c).toContain('setOwnerGate');
    expect(c).toContain('openOwnerTurn');
  });
});

describe('useAuth - code integrity', () => {
  it('exports openOwnerTurn', () => {
    const c = fs.readFileSync(path.join(REPO, 'frontend/src/hooks/useAuth.js'), 'utf8');
    expect(c).toContain('openOwnerTurn');
    expect(c).toContain('login/owner');
  });
});

describe('Backend - /login/owner endpoint', () => {
  it('exists in operators.py', () => {
    const c = fs.readFileSync(path.join(REPO, 'backend/routers/operators.py'), 'utf8');
    expect(c).toContain('/api/login/owner');
    expect(c).toContain('_ensure_open_turn');
  });
});

describe('useCart - null safety', () => {
  it('uses optional chaining on productsDB', () => {
    const c = fs.readFileSync(path.join(REPO, 'frontend/src/hooks/useCart.js'), 'utf8');
    expect(c).toContain('productsDB?.find');
  });
});

describe('Sidebar - collapse', () => {
  it('has toggle and collapse classes', () => {
    const c = fs.readFileSync(path.join(REPO, 'frontend/src/components/pos/Sidebar.jsx'), 'utf8');
    expect(c).toContain('collapsed');
    expect(c).toContain('sidebar-toggle');
    expect(c).toContain('sidebar-backdrop');
  });
});

describe('SearchBar - camera scanner', () => {
  it('has CameraBarcodeScanner and showScanner state', () => {
    const c = fs.readFileSync(path.join(REPO, 'frontend/src/components/pos/SearchBar.jsx'), 'utf8');
    expect(c).toContain('CameraBarcodeScanner');
    expect(c).toContain('showScanner');
  });
});

describe('CSS - sidebar collapse styles', () => {
  it('has .sidebar.collapsed and .sidebar-backdrop rules', () => {
    const c = fs.readFileSync(path.join(REPO, 'frontend/src/index.css'), 'utf8');
    expect(c).toContain('.sidebar.collapsed');
    expect(c).toContain('sidebar-toggle');
    expect(c).toContain('sidebar-backdrop');
  });
});
