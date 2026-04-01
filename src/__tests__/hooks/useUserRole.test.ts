import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useUserRole } from '@/hooks/useUserRole';


// Mock do AuthContext
const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth()
}));

describe('useUserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null values when no profile', () => {
    mockUseAuth.mockReturnValue({
      role: null,
      barbeariaId: null,
      loading: false
    });

    const { result } = renderHook(() => useUserRole());

    expect(result.current.role).toBeNull();
    expect(result.current.barbeariaId).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('should return profile data when available', () => {
    mockUseAuth.mockReturnValue({
      role: 'admin',
      barbeariaId: 'barbearia123',
      loading: false
    });

    const { result } = renderHook(() => useUserRole());

    expect(result.current.role).toBe('admin');
    expect(result.current.barbeariaId).toBe('barbearia123');
    expect(result.current.loading).toBe(false);
  });

  it('should return loading state', () => {
    mockUseAuth.mockReturnValue({
      role: null,
      barbeariaId: null,
      loading: true
    });

    const { result } = renderHook(() => useUserRole());

    expect(result.current.loading).toBe(true);
  });

  it('should handle cliente role', () => {
    const mockProfile = {
      role: 'cliente',
      barbeariaId: null,
      nome: 'Cliente Test'
    };

    mockUseAuth.mockReturnValue({
      role: mockProfile.role,
      barbeariaId: mockProfile.barbeariaId,
      loading: false
    });

    const { result } = renderHook(() => useUserRole());

    expect(result.current.role).toBe('cliente');
    expect(result.current.barbeariaId).toBeNull();
  });

  it('should handle funcionario role', () => {
    const mockProfile = {
      role: 'funcionario',
      barbeariaId: 'barbearia456',
      nome: 'Funcionario Test'
    };

    mockUseAuth.mockReturnValue({
      role: mockProfile.role,
      barbeariaId: mockProfile.barbeariaId,
      loading: false
    });

    const { result } = renderHook(() => useUserRole());

    expect(result.current.role).toBe('funcionario');
    expect(result.current.barbeariaId).toBe('barbearia456');
  });
});