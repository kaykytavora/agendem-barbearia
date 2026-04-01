import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { endOfWeek, format, addDays, parseISO, isWithinInterval, isSameDay } from 'date-fns';

export type SlotStatus = 'disponivel' | 'ocupado' | 'pausa' | 'fechado' | 'ausente';

export interface AgendaSlot {
  hora: string;
  data: Date;
  status: SlotStatus;
  agendamento?: {
    id: string;
    cliente_nome: string;
    cliente_telefone: string;
    servico_nome: string;
    servico_duracao: number;
    status: string;
  };
  pausa?: {
    id: string;
    motivo: string | null;
  };
}

export interface AgendaDay {
  data: Date;
  diaSemana: number;
  slots: AgendaSlot[];
  fechado: boolean;
}

interface UseAgendaDataParams {
  funcionarioId: string | null;
  barbeariaId: string | null;
  weekStart: Date;
}

export function useAgendaData({ funcionarioId, barbeariaId, weekStart }: UseAgendaDataParams) {
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  // Fetch operating hours
  const { data: horarios } = useQuery({
    queryKey: ['horarios-funcionamento', barbeariaId],
    queryFn: async () => {
      if (!barbeariaId) return [];
      const { data, error } = await supabase
        .from('horarios_funcionamento')
        .select('*')
        .eq('barbearia_id', barbeariaId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!barbeariaId,
  });

  // Fetch appointments for the week
  const { data: agendamentos, isLoading: loadingAgendamentos } = useQuery({
    queryKey: ['agendamentos-agenda', funcionarioId, format(weekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!funcionarioId || !barbeariaId) return [];
      
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('agendamentos')
        .select(`
          id,
          data_hora,
          cliente_nome,
          cliente_telefone,
          status,
          servico_id,
          servicos:servico_id (nome, duracao_minutos)
        `)
        .eq('funcionario_id', funcionarioId)
        .gte('data_hora', `${startDate}T00:00:00`)
        .lte('data_hora', `${endDate}T23:59:59`)
        .in('status', ['pendente', 'confirmado']);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!funcionarioId && !!barbeariaId,
  });

  // Fetch pauses for the week
  const { data: pausas } = useQuery({
    queryKey: ['pausas-agenda', funcionarioId, format(weekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!funcionarioId || !barbeariaId) return [];
      
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('funcionario_pausas')
        .select('*')
        .eq('funcionario_id', funcionarioId)
        .gte('data', startDate)
        .lte('data', endDate);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!funcionarioId && !!barbeariaId,
  });

  // Fetch absences (férias/recesso)
  const { data: ausencias } = useQuery({
    queryKey: ['ausencias-agenda', funcionarioId, format(weekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!funcionarioId || !barbeariaId) return [];
      
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('funcionario_ausencias')
        .select('*')
        .eq('funcionario_id', funcionarioId)
        .or(`data_inicio.lte.${endDate},data_fim.gte.${startDate}`);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!funcionarioId && !!barbeariaId,
  });

  // Generate agenda grid
  const generateAgenda = (): AgendaDay[] => {
    if (!horarios || !barbeariaId) return [];

    const days: AgendaDay[] = [];

    for (let i = 0; i < 7; i++) {
      const currentDate = addDays(weekStart, i);
      const diaSemana = currentDate.getDay();
      const horarioDia = horarios.find(h => h.dia_semana === diaSemana);
      
      const day: AgendaDay = {
        data: currentDate,
        diaSemana,
        slots: [],
        fechado: horarioDia?.fechado ?? true,
      };

      if (horarioDia && !horarioDia.fechado && horarioDia.hora_abre && horarioDia.hora_fecha) {
        const [horaAbre] = horarioDia.hora_abre.split(':').map(Number);
        const [horaFecha] = horarioDia.hora_fecha.split(':').map(Number);

        // Check if employee is absent this day
        const isAusente = ausencias?.some(a => {
          const inicio = parseISO(a.data_inicio);
          const fim = parseISO(a.data_fim);
          return isWithinInterval(currentDate, { start: inicio, end: fim }) || 
                 isSameDay(currentDate, inicio) || 
                 isSameDay(currentDate, fim);
        });

        for (let hora = horaAbre; hora < horaFecha; hora++) {
          for (const minuto of [0, 30]) {
            const horaStr = `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;
            const slotDateTime = new Date(currentDate);
            slotDateTime.setHours(hora, minuto, 0, 0);

            let status: SlotStatus = 'disponivel';
            let agendamentoData;
            let pausaData;

            if (isAusente) {
              status = 'ausente';
            } else {
              // Check for pause
              const pausa = pausas?.find(p => {
                if (p.data !== format(currentDate, 'yyyy-MM-dd')) return false;
                const [pHoraInicio] = p.hora_inicio.split(':').map(Number);
                const [pMinInicio] = p.hora_inicio.split(':').slice(1).map(Number);
                const [pHoraFim] = p.hora_fim.split(':').map(Number);
                const [pMinFim] = p.hora_fim.split(':').slice(1).map(Number);
                
                const pausaInicio = pHoraInicio * 60 + pMinInicio;
                const pausaFim = pHoraFim * 60 + pMinFim;
                const slotMinutos = hora * 60 + minuto;
                
                return slotMinutos >= pausaInicio && slotMinutos < pausaFim;
              });

              if (pausa) {
                status = 'pausa';
                pausaData = { id: pausa.id, motivo: pausa.motivo };
              } else {
                // Check for appointment
                const agendamento = agendamentos?.find(a => {
                  const agendamentoDate = new Date(a.data_hora);
                  return isSameDay(agendamentoDate, currentDate) &&
                         agendamentoDate.getHours() === hora &&
                         agendamentoDate.getMinutes() === minuto;
                });

                if (agendamento) {
                  status = 'ocupado';
                  const servico = agendamento.servicos as { nome: string; duracao_minutos: number } | null;
                  agendamentoData = {
                    id: agendamento.id,
                    cliente_nome: agendamento.cliente_nome,
                    cliente_telefone: agendamento.cliente_telefone,
                    servico_nome: servico?.nome || 'Serviço',
                    servico_duracao: servico?.duracao_minutos || 30,
                    status: agendamento.status,
                  };
                }
              }
            }

            day.slots.push({
              hora: horaStr,
              data: slotDateTime,
              status,
              agendamento: agendamentoData,
              pausa: pausaData,
            });
          }
        }
      }

      days.push(day);
    }

    return days;
  };

  return {
    agenda: generateAgenda(),
    isLoading: loadingAgendamentos,
    horarios,
  };
}

// Fetch employees for the selector
export function useFuncionarios(barbeariaId: string | null) {
  return useQuery({
    queryKey: ['funcionarios-agenda', barbeariaId],
    queryFn: async () => {
      if (!barbeariaId) return [];
      const { data, error } = await supabase
        .from('funcionarios')
        .select('id, nome, nivel, is_owner, user_id')
        .eq('barbearia_id', barbeariaId)
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: !!barbeariaId,
  });
}
