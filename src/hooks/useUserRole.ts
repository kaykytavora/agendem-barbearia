import { useAuth } from '@/contexts/AuthContext';
import type { Database } from '@/integrations/supabase/types';

type UserRole = Database['public']['Enums']['user_role'];

interface UserRoleData {
  role: UserRole | null;
  barbeariaId: string | null;
  loading: boolean;
  error: null; // Error is now handled in AuthContext
  isFuncionario: boolean;
  isAdmin: boolean;
  isStaff: boolean;
}

export function useUserRole(): UserRoleData {
  const { role, barbeariaId, loading } = useAuth();

  return { 
    role, 
    barbeariaId, 
    loading, 
    error: null,
    isFuncionario: role === 'funcionario',
    isAdmin: role === 'admin',
    isStaff: role === 'admin' || role === 'funcionario'
  };
}

// Helper function to check if user has a specific role
export function useHasRole(requiredRole: UserRole): boolean {
  const { role } = useUserRole();
  return role === requiredRole;
}

// Helper function to check if user is admin
export function useIsAdmin(): boolean {
  return useHasRole('admin');
}

// Helper function to check if user is funcionario or admin
export function useIsStaff(): boolean {
  const { role } = useUserRole();
  return role === 'admin' || role === 'funcionario';
}

// Helper function to check if user is only funcionario (not admin)
export function useIsFuncionario(): boolean {
  return useHasRole('funcionario');
}