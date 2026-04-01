import { render, screen } from "@testing-library/react";
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import ProtectedRoute from '@/components/ProtectedRoute';


// Mock do AuthContext
const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

// Mock do PageLoader
vi.mock('@/components/PageLoader', () => ({
  default: () => <div data-testid="page-loader">Loading...</div>
}));

// Componente de teste
const TestComponent = () => <div data-testid="protected-content">Protected Content</div>;

// Helper para renderizar com Router
const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show loading when auth is loading', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      role: null,
      loading: true
    });

    renderWithRouter(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>
    );

    expect(screen.getByTestId('page-loader')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should redirect to login when user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      role: null,
      loading: false
    });

    renderWithRouter(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>
    );

    // O componente deve redirecionar, então o conteúdo protegido não deve aparecer
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should render children when user is authenticated and no role required', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '123', email: 'test@test.com' },
      role: 'cliente',
      loading: false
    });

    renderWithRouter(
      <ProtectedRoute>
        <TestComponent />
      </ProtectedRoute>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('should render children when user has required role', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '123', email: 'test@test.com' },
      role: 'admin',
      loading: false
    });

    renderWithRouter(
      <ProtectedRoute requiredRole="admin">
        <TestComponent />
      </ProtectedRoute>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('should redirect to unauthorized when user does not have required role', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '123', email: 'test@test.com' },
      role: 'cliente',
      loading: false
    });

    renderWithRouter(
      <ProtectedRoute requiredRole="admin">
        <TestComponent />
      </ProtectedRoute>
    );

    // Deve redirecionar para unauthorized
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should allow admin to access funcionario routes', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '123', email: 'test@test.com' },
      role: 'admin',
      loading: false
    });

    renderWithRouter(
      <ProtectedRoute requiredRole="funcionario">
        <TestComponent />
      </ProtectedRoute>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
});