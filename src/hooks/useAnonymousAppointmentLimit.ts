import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const LIMITE_AGENDAMENTOS_ANONIMOS = 3;

interface AnonymousLimitResult {
  canBook: boolean;
  currentCount: number;
  maxLimit: number;
  errorMessage?: string;
}

export const useAnonymousAppointmentLimit = () => {
  const [loading, setLoading] = useState(false);

  const checkAppointmentLimit = async (phoneNumber: string, userId?: string): Promise<AnonymousLimitResult> => {
    setLoading(true);
    
    try {
      // Se o usuário está logado, não aplicar limite
      if (userId) {
        return {
          canBook: true,
          currentCount: 0,
          maxLimit: LIMITE_AGENDAMENTOS_ANONIMOS
        };
      }

      // Se telefone é inválido
      if (!phoneNumber || phoneNumber.trim() === '') {
        return {
          canBook: false,
          currentCount: 0,
          maxLimit: LIMITE_AGENDAMENTOS_ANONIMOS,
          errorMessage: 'Número de telefone é obrigatório para agendamentos'
        };
      }

      // Buscar agendamentos ativos para o telefone
      const { data: agendamentos, error } = await supabase
        .from('agendamentos')
        .select('id')
        .eq('cliente_telefone', phoneNumber)
        .in('status', ['pendente', 'confirmado'])
        .is('user_id', null); // Apenas agendamentos anônimos

      if (error) {
        console.error('Erro ao verificar agendamentos:', error);
        return {
          canBook: false,
          currentCount: 0,
          maxLimit: LIMITE_AGENDAMENTOS_ANONIMOS,
          errorMessage: 'Erro ao verificar agendamentos existentes'
        };
      }

      const currentCount = agendamentos?.length || 0;
      const canBook = currentCount < LIMITE_AGENDAMENTOS_ANONIMOS;

      return {
        canBook,
        currentCount,
        maxLimit: LIMITE_AGENDAMENTOS_ANONIMOS,
        errorMessage: canBook ? undefined : `Você já possui ${currentCount} agendamento(s) ativo(s). Limite máximo: ${LIMITE_AGENDAMENTOS_ANONIMOS} por telefone.`
      };

    } catch (error) {
      console.error('Erro na verificação de limite:', error);
      return {
        canBook: false,
        currentCount: 0,
        maxLimit: LIMITE_AGENDAMENTOS_ANONIMOS,
        errorMessage: 'Erro interno ao verificar limites de agendamento'
      };
    } finally {
      setLoading(false);
    }
  };

  const getActiveAppointments = async (phoneNumber: string) => {
    try {
      const { data: agendamentos, error } = await supabase
        .from('agendamentos')
        .select(`
          id,
          data_hora,
          status,
          barbearias!inner(nome),
          servicos!inner(nome, valor, duracao_minutos)
        `)
        .eq('cliente_telefone', phoneNumber)
        .in('status', ['pendente', 'confirmado'])
        .is('user_id', null)
        .order('data_hora', { ascending: true });

      if (error) throw error;

      return agendamentos || [];
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      return [];
    }
  };

  const handleBookingError = (error: any): string => {
    // Verificar se é erro de limite de agendamentos
    if (error?.message?.includes('LIMITE_AGENDAMENTOS_ANONIMOS')) {
      return 'Você atingiu o limite máximo de agendamentos ativos. Finalize ou cancele agendamentos existentes antes de criar um novo.';
    }

    // Outros erros de validação do Supabase
    if (error?.message?.includes('check constraint') || error?.code === 'P0001') {
      return 'Não é possível criar o agendamento devido a restrições de segurança.';
    }

    // Erro genérico
    return 'Erro ao criar agendamento. Tente novamente.';
  };

  return {
    loading,
    checkAppointmentLimit,
    getActiveAppointments,
    handleBookingError,
    LIMITE_AGENDAMENTOS_ANONIMOS
  };
};