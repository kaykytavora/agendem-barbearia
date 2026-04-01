import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FuncionarioAusencia {
  id?: string;
  funcionario_id: string;
  barbearia_id: string;
  tipo: 'ferias' | 'recesso' | 'outro';
  data_inicio: string;
  data_fim: string;
  motivo?: string;
  created_at?: string;
  updated_at?: string;
}

export function useFuncionarioAusencias(barbeariaId: string) {
  const queryClient = useQueryClient();

  const { data: ausencias, isLoading } = useQuery({
    queryKey: ['funcionario-ausencias', barbeariaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funcionario_ausencias')
        .select(`
          *,
          funcionarios (
            id,
            nome
          )
        `)
        .eq('barbearia_id', barbeariaId)
        .order('data_inicio', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!barbeariaId,
  });

  const createAusencia = useMutation({
    mutationFn: async (ausencia: FuncionarioAusencia) => {
      const { data, error } = await supabase
        .from('funcionario_ausencias')
        .insert(ausencia)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcionario-ausencias', barbeariaId] });
      toast.success('Ausência cadastrada com sucesso');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao cadastrar ausência');
    },
  });

  const updateAusencia = useMutation({
    mutationFn: async ({ id, ...ausencia }: FuncionarioAusencia) => {
      if (!id) throw new Error('ID is required for update');
      
      const { data, error } = await supabase
        .from('funcionario_ausencias')
        .update(ausencia)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (barbeariaId) {
        queryClient.invalidateQueries({ queryKey: ['funcionario-ausencias', barbeariaId] });
      }
      toast.success('Ausência atualizada com sucesso');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar ausência');
    },
  });

  const deleteAusencia = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('funcionario_ausencias')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      if (barbeariaId) {
        queryClient.invalidateQueries({ queryKey: ['funcionario-ausencias', barbeariaId] });
      }
      toast.success('Ausência removida com sucesso');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao remover ausência');
    },
  });

  return {
    ausencias,
    isLoading,
    createAusencia,
    updateAusencia,
    deleteAusencia,
  };
}

export function useCheckFuncionarioDisponibilidade() {
  return useMutation({
    mutationFn: async ({ funcionarioId, dataHora }: { funcionarioId: string; dataHora: string }) => {
      const { data, error } = await supabase.rpc('check_funcionario_disponibilidade', {
        p_funcionario_id: funcionarioId,
        p_data_hora: dataHora,
      });

      if (error) throw error;
      return data as boolean;
    },
  });
}
