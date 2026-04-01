import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BillingStatus {
  plan: 'legacy';
  status: 'active';
  paid_until: string | null;
  limits: PlanLimits;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  payment_failures_count: number;
  grace_period_ends_at: string | null;
}

export interface FeatureAccess {
  can_access: boolean;
  reason?: string;
  limit_reached?: boolean;
  current_usage?: number;
  limit?: number;
}

export interface PlanLimits {
  staff_seats: number;
  max_bookings_per_month: number;
  max_services: number;
  multiple_locations: boolean;
  advanced_analytics: boolean;
  priority_support: boolean;
  current_staff?: number;
  current_bookings_this_month?: number;
  current_services?: number;
}

export type SubscriptionStatus = 'active';
export type SubscriptionPlan = 'legacy';

// Hook principal para status de billing - Mock implementation for legacy plan
export function useBillingStatus(barbeariaId: string) {
  return useQuery({
    queryKey: ['billing-status', barbeariaId],
    queryFn: async (): Promise<BillingStatus> => {
      // Mock data for legacy plan with unlimited access
      return {
        plan: 'legacy',
        status: 'active',
        paid_until: null,
        limits: {
          staff_seats: 999,
          max_bookings_per_month: 999,
          max_services: 999,
          multiple_locations: true,
          advanced_analytics: true,
          priority_support: true
        },
        stripe_customer_id: null,
        stripe_subscription_id: null,
        payment_failures_count: 0,
        grace_period_ends_at: null
      };
    },
    enabled: !!barbeariaId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

// Mock functions that always return true for legacy plan users
export function useCanCreateBooking(barbeariaId: string) {
  return {
    mutate: (callback?: (result: boolean) => void) => {
      if (callback) callback(true);
    },
    mutateAsync: async (): Promise<boolean> => true,
    isPending: false,
    isSuccess: true,
    data: true
  };
}

export function useCanAddStaff(barbeariaId: string) {
  return {
    mutate: (callback?: (result: boolean) => void) => {
      if (callback) callback(true);
    },
    mutateAsync: async (): Promise<boolean> => true,
    isPending: false,
    isSuccess: true,
    data: true
  };
}

export function useCanAddService(barbeariaId: string) {
  return {
    mutate: (callback?: (result: boolean) => void) => {
      if (callback) callback(true);
    },
    mutateAsync: async (): Promise<boolean> => true,
    isPending: false,
    isSuccess: true,
    data: true
  };
}

// Mock feature access for legacy users (always returns true)
export function useFeatureAccess(barbeariaId: string, feature: string) {
  return useQuery({
    queryKey: ['feature-access', barbeariaId, feature],
    queryFn: async (): Promise<FeatureAccess> => {
      return {
        can_access: true,
        reason: undefined,
        limit_reached: false,
        current_usage: 0,
        limit: 999
      };
    },
    enabled: !!barbeariaId && !!feature,
    staleTime: 2 * 60 * 1000,
  });
}

// Mock permission check for legacy users (always returns true)
export function useBulkPermissionCheck(barbeariaId: string) {
  return useQuery({
    queryKey: ['bulk-permissions', barbeariaId],
    queryFn: async () => {
      return {
        canCreateBooking: true,
        canAddStaff: true,
        canAddService: true,
        errors: {
          booking: undefined,
          staff: undefined,
          service: undefined
        }
      };
    },
    enabled: !!barbeariaId,
    staleTime: 2 * 60 * 1000,
  });
}

// Hook para obter estatísticas de uso atual
export function useUsageStats(barbeariaId: string) {
  return useQuery({
    queryKey: ['usage-stats', barbeariaId],
    queryFn: async () => {
      const currentMonth = new Date();
      const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const [staffCount, servicesCount, bookingsCount] = await Promise.all([
        // Contar funcionários
        supabase
          .from('funcionarios')
          .select('id', { count: 'exact', head: true })
          .eq('barbearia_id', barbeariaId),
        
        // Contar serviços
        supabase
          .from('servicos')
          .select('id', { count: 'exact', head: true })
          .eq('barbearia_id', barbeariaId),
        
        // Contar agendamentos do mês atual
        supabase
          .from('agendamentos')
          .select('id', { count: 'exact', head: true })
          .eq('barbearia_id', barbeariaId)
          .gte('created_at', firstDay.toISOString())
          .lte('created_at', lastDay.toISOString())
      ]);

      return {
        staff_count: staffCount.count || 0,
        services_count: servicesCount.count || 0,
        bookings_this_month: bookingsCount.count || 0
      };
    },
    enabled: !!barbeariaId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

// Tipo para facilitar o uso