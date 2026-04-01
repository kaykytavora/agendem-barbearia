import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Clock, DollarSign, Plus, MoreVertical, CheckCircle, TrendingUp, Star, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Link, useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useResponsive, useResponsiveClasses } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";



interface WorkingHours {
  dia_semana: number;
  hora_abre: string;
  hora_fecha: string;
  fechado: boolean;
}

interface PauseData {
  inicio: string;
  fim: string;
  motivo?: string;
}

interface FuncionarioPausa {
  id: string;
  funcionario_id: string;
  barbearia_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  motivo: string | null;
}

// --- Funções de busca de dados ---
const fetchBarbeariaData = async (userId: string) => {
  if (!userId) throw new Error("Usuário não autenticado.");

  const { data: barbeariaId, error: rpcError } = await supabase.rpc('get_user_barbearia_id', { user_uuid: userId });
  if (rpcError) throw new Error(rpcError.message);
  if (!barbeariaId) throw new Error("Usuário não associado a uma barbearia.");
  
  const { data: agendamentos, error: agendamentosError } = await supabase
    .from('agendamentos')
    .select('*, servicos!inner(nome, valor), funcionarios(nome)')
    .eq('barbearia_id', barbeariaId);

  if (agendamentosError) throw agendamentosError;

  const { count: funcionarios_total, error: funcionariosError } = await supabase
    .from('funcionarios')
    .select('*', { count: 'exact', head: true })
    .eq('barbearia_id', barbeariaId);
  
  if (funcionariosError) throw funcionariosError;

  return { 
    agendamentos: agendamentos || [], 
    funcionarios_total: funcionarios_total || 0 
  };
};

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { role } = useUserRole();
  const { isMobile } = useResponsive();
  const responsive = useResponsiveClasses();
  const navigate = useNavigate();
  const [isPaused, setIsPaused] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pauseData, setPauseData] = useState<PauseData>({ inicio: '', fim: '', motivo: '' });
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [isOwnerEmployee, setIsOwnerEmployee] = useState(false);

  // --- React Query ---
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dashboardData', user?.id],
    queryFn: () => fetchBarbeariaData(user!.id),
    enabled: !!user,
    staleTime: 0, // Sempre considerar dados como stale
    gcTime: 0, // Não manter cache
    refetchOnWindowFocus: true, // Refetch quando a janela ganhar foco
    refetchOnMount: true, // Sempre refetch ao montar
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ appointmentId, status }: { appointmentId: string, status: 'finalizado' | 'cancelado' }) => {
      const { error } = await supabase
        .from('agendamentos')
        .update({ status })
        .eq('id', appointmentId);
      if (error) throw error;

      // Feedback não é mais criado automaticamente
      // O cliente deve avaliar manualmente se desejar

      return status;
    },
    onSuccess: (status) => {
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
      toast({
        title: "Sucesso!",
        description: `Agendamento ${status === 'finalizado' ? 'finalizado' : 'cancelado'} com sucesso.`,
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro",
        description: (error as Error).message || "Não foi possível atualizar o status.",
        variant: "destructive"
      });
    }
  });

  // Buscar horários de funcionamento
  const { data: workingHours } = useQuery({
    queryKey: ['working-hours', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data: barbeariaId, error: rpcError } = await supabase.rpc(
        'get_user_barbearia_id',
        { user_uuid: user.id }
      );
      
      if (rpcError || !barbeariaId) throw new Error('Usuário não associado a uma barbearia');
      
      const { data, error } = await supabase
        .from('horarios_funcionamento')
        .select('*')
        .eq('barbearia_id', barbeariaId)
        .order('dia_semana');
      
      if (error) throw error;
      return data as WorkingHours[];
    },
    enabled: !!user?.id,
  });

  // Buscar funcionário do usuário atual
  const { data: currentFuncionario } = useQuery({
    queryKey: ['current-funcionario', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('funcionarios')
        .select('id, barbearia_id, is_owner')
        .eq('user_id', user.id)
        .single();
      
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  // Buscar pausa ativa do funcionário para hoje
  const { data: pausaAtiva, refetch: refetchPausa } = useQuery({
    queryKey: ['pausa-ativa', currentFuncionario?.id],
    queryFn: async () => {
      if (!currentFuncionario?.id) return null;
      
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toTimeString().slice(0, 5);
      
      const { data, error } = await supabase
        .from('funcionario_pausas')
        .select('*')
        .eq('funcionario_id', currentFuncionario.id)
        .eq('data', today)
        .gte('hora_fim', now)
        .order('hora_inicio', { ascending: true })
        .limit(1)
        .maybeSingle();
      
      if (error) return null;
      return data as FuncionarioPausa | null;
    },
    enabled: !!currentFuncionario?.id,
  });

  // Atualizar estado isPaused baseado na pausa ativa
  useEffect(() => {
    setIsPaused(!!pausaAtiva);
  }, [pausaAtiva]);

  // Verificar se o admin também é funcionário (dono registrado na equipe)
  useEffect(() => {
    if (role === 'admin' && currentFuncionario) {
      setIsOwnerEmployee(true);
    } else if (role !== 'admin') {
      setIsOwnerEmployee(false);
    } else {
      setIsOwnerEmployee(false);
    }
  }, [currentFuncionario, role]);

  // Função para gerar slots de tempo (pausas terminam 30min antes do fechamento)
  const generateTimeSlots = (start: string, end: string, forPauseEnd: boolean = false): string[] => {
    const slots: string[] = [];
    
    // Normalizar formato de hora para HH:MM (remover segundos se existirem)
    const normalizeTime = (time: string) => time.slice(0, 5);
    
    const normalizedStart = normalizeTime(start);
    const normalizedEnd = normalizeTime(end);
    
    const startTime = new Date(`2000-01-01T${normalizedStart}:00`);
    const endTime = new Date(`2000-01-01T${normalizedEnd}:00`);
    
    // Para horário de fim de pausa, terminar 30 minutos antes do fechamento
    if (forPauseEnd) {
      endTime.setMinutes(endTime.getMinutes() - 30);
    }
    
    const current = new Date(startTime);
    while (current <= endTime) {
      slots.push(current.toTimeString().slice(0, 5));
      current.setMinutes(current.getMinutes() + 30);
    }
    
    return slots;
  };

  // Gerar horários disponíveis baseado no dia atual
  useEffect(() => {
    const today = new Date().getDay();
    let slots: string[] = [];
    
    if (workingHours && workingHours.length > 0) {
      const todayHours = workingHours.find(h => h.dia_semana === today);
      
      if (todayHours && !todayHours.fechado) {
        // Gerar slots com limite de 30min antes do fechamento
        slots = generateTimeSlots(todayHours.hora_abre, todayHours.hora_fecha, true);
      }
    }
    
    // Se não há slots ou é domingo, usar horários padrão (até 17:30 = 30min antes de 18:00)
    if (slots.length === 0 && today !== 0) {
      slots = generateTimeSlots('08:00', '18:00', true);
    }
    
    // Garantir que sempre há pelo menos alguns horários básicos para pausa
    if (slots.length === 0) {
      slots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '17:30'];
    }
    
    setAvailableTimeSlots(slots);
  }, [workingHours]);

  // Mutation para criar pausa
  const createPausaMutation = useMutation({
    mutationFn: async (data: PauseData) => {
      if (!currentFuncionario?.id || !currentFuncionario?.barbearia_id) {
        throw new Error('Funcionário não encontrado');
      }
      
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('funcionario_pausas')
        .insert({
          funcionario_id: currentFuncionario.id,
          barbearia_id: currentFuncionario.barbearia_id,
          data: today,
          hora_inicio: data.inicio,
          hora_fim: data.fim,
          motivo: data.motivo || null,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      setIsDialogOpen(false);
      setPauseData({ inicio: '', fim: '', motivo: '' });
      refetchPausa();
      toast({
        title: "Pausa marcada",
        description: `Pausa marcada das ${pauseData.inicio} às ${pauseData.fim}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao marcar pausa",
        variant: "destructive",
      });
    },
  });

  // Mutation para remover pausa
  const removePausaMutation = useMutation({
    mutationFn: async () => {
      if (!pausaAtiva?.id) {
        throw new Error('Nenhuma pausa ativa');
      }
      
      const { error } = await supabase
        .from('funcionario_pausas')
        .delete()
        .eq('id', pausaAtiva.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      refetchPausa();
      toast({
        title: "Pausa removida",
        description: "Você voltou ao trabalho",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao remover pausa",
        variant: "destructive",
      });
    },
  });

  const handlePauseSubmit = () => {
    if (!pauseData.inicio || !pauseData.fim) {
      toast({
        title: "Erro",
        description: "Selecione horário de início e fim da pausa",
        variant: "destructive",
      });
      return;
    }
    
    if (pauseData.inicio >= pauseData.fim) {
      toast({
        title: "Erro",
        description: "Horário de fim deve ser posterior ao início",
        variant: "destructive",
      });
      return;
    }
    
    createPausaMutation.mutate(pauseData);
  };

  // --- Cálculos com useMemo ---
  const { agendamentosHoje, stats } = useMemo(() => {
    if (!data) {
      return { 
        agendamentosHoje: [], 
        stats: { agendamentos_hoje: 0, receita_mes: 0, servicos_populares: [] } 
      };
    }

    const todosAgendamentos = data?.agendamentos || [];
      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

    const agendamentosHojeFiltrados = todosAgendamentos.filter((ag: any) => {
        const dataAg = new Date(ag.data_hora);
        return dataAg.toDateString() === hoje.toDateString() && ag.status !== 'cancelado';
    });

    const receitaMes = todosAgendamentos.filter((ag: any) => {
        const dataAg = new Date(ag.data_hora);
        return dataAg >= inicioMes && dataAg <= fimMes && ag.status === 'finalizado';
    }).reduce((total: number, ag: any) => total + (ag.servicos?.valor || 0), 0);

      const contagemServicos = todosAgendamentos
      .filter((ag: any) => ag.status !== 'cancelado' && ag.servicos)
        .reduce((acc: any, ag: any) => {
          const nomeServico = ag.servicos!.nome;
          acc[nomeServico] = (acc[nomeServico] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      
      const totalAgendamentosValidos = Object.values(contagemServicos).reduce((a, b) => (a as number) + (b as number), 0);
      const servicosPopulares = Object.entries(contagemServicos)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 3)
        .map(([nome, contagem]) => ({
          nome,
          porcentagem: (totalAgendamentosValidos as number) > 0 ? Math.round(((contagem as number) / (totalAgendamentosValidos as number)) * 100) : 0
        }));

    return {
      agendamentosHoje: agendamentosHojeFiltrados,
      stats: {
        agendamentos_hoje: agendamentosHojeFiltrados.length,
        receita_mes: receitaMes,
        servicos_populares: servicosPopulares
      }
    };
  }, [data]);

  const handleUpdateStatus = (appointmentId: string, status: 'finalizado' | 'cancelado') => {
    updateStatusMutation.mutate({ appointmentId, status });
  };

  const handleRefreshData = () => {
    refetch();
    toast({
      title: "Atualizando dados...",
      description: "Os dados do dashboard estão sendo atualizados.",
    });
  };

  const handleConfirmarAtendimento = () => {
    // Navegar para agendamentos com filtro de pendentes
    navigate('/dashboard/appointments?status=confirmado'); // Mudou de pendente para confirmado
  };

  const handleMarcarPausa = () => {
    if (isPaused) {
      removePausaMutation.mutate();
    } else {
      setIsDialogOpen(true);
    }
  };

  const handleVerFeedback = () => {
    navigate('/dashboard/feedbacks');
  };
      
  // O array de stats para os cards, agora usando os dados de 'data' e 'stats'
  const dashboardStats = [
    {
      title: "Agendamentos Hoje",
      value: stats.agendamentos_hoje.toString(),
      change: "+2 desde ontem", // Placeholder
      icon: Calendar,
      color: "text-primary"
    },
    {
      title: "Receita do Mês",
      value: `R$ ${stats.receita_mes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      change: "+15% vs mês anterior", // Placeholder
      icon: DollarSign,
      color: "text-green-500"
    },
    {
      title: "Total de Funcionários",
      value: (data?.funcionarios_total || 0).toString(),
      change: "+1 este mês", // Placeholder
      icon: Users,
      color: "text-blue-500"
    },
    {
      title: "Serviço Mais Popular",
      value: stats.servicos_populares[0]?.nome || "N/A",
      change: `${stats.servicos_populares[0]?.porcentagem || 0}% dos agendamentos`,
      icon: Star,
      color: "text-purple-500"
    }
  ];

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmado':
        return 'text-green-500 border-green-500/50 bg-green-500/10';
      case 'pendente':
        return 'text-yellow-500 border-yellow-500/50 bg-yellow-500/10';
      case 'cancelado':
        return 'text-red-500 border-red-500/50 bg-red-500/10';
      case 'finalizado':
        return 'text-blue-500 border-blue-500/50 bg-blue-500/10';
      default:
        return 'text-gray-500 border-gray-500/50 bg-gray-500/10';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmado':
        return 'Confirmado';
      case 'pendente':
        return 'Pendente';
      case 'cancelado':
        return 'Cancelado';
      case 'finalizado':
        return 'Finalizado';
      default:
        return status;
    }
  };

  const statusOrder: { [key: string]: number } = {
    pendente: 1,
    confirmado: 2,
    finalizado: 3,
    cancelado: 4,
  };

  const getStatusBadge = (status: string) => {
    const statusClass = getStatusColor(status);
    const label = getStatusLabel(status);
    
    return (
      <Badge variant="outline" className={statusClass}>
        <CheckCircle className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={`space-y-6 ${isMobile ? 'p-4' : 'p-6'}`}>
        {/* Header */}
        <div className={`flex flex-col ${isMobile ? 'gap-4' : 'sm:flex-row'} justify-between items-start ${!isMobile ? 'sm:items-center' : ''} gap-4`}>
          <div className="flex-1">
            <div className={`flex items-center ${isMobile ? 'gap-3' : 'gap-4'} mb-2`}>
              <div className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} bg-gradient-primary rounded-full flex items-center justify-center`}>
                <span className={`text-white font-medium ${isMobile ? 'text-sm' : 'text-lg'}`}>
                  {user?.user_metadata?.name?.slice(0, 2).toUpperCase() || user?.email?.slice(0, 2).toUpperCase() || "US"}
                </span>
              </div>
              <div>
                <h1 className={`${responsive.heading.h1} font-bold`}>
                  {role === 'admin' ? "Dashboard Admin" : "Meus Horários"}
                </h1>
                <p className={`text-muted-foreground ${isMobile ? 'text-sm' : ''}`}>
                  Bem-vindo, {user?.user_metadata?.name || "Usuário"}!
                </p>
              </div>
            </div>
            <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
              {role === 'admin' ? "Visão geral da sua barbearia" : "Seus agendamentos"} hoje, {new Date().toLocaleDateString('pt-BR', { 
                weekday: isMobile ? 'short' : 'long', 
                year: 'numeric', 
                month: isMobile ? 'short' : 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          
          <div className={`flex gap-2 ${isMobile ? 'w-full' : ''}`}>
            <Button 
              variant="outline" 
              onClick={handleRefreshData} 
              className={`${isMobile ? 'h-12' : ''} touch-target`}
              disabled={isLoading}
            >
              <RefreshCw className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'} ${isLoading ? 'animate-spin' : ''}`} />
              {!isMobile && <span className="ml-2">Atualizar</span>}
            </Button>
            <Link to="/dashboard/new-appointment" className={isMobile ? 'flex-1' : ''}>
              <Button className={`${isMobile ? 'w-full h-12 text-base' : ''} touch-target`}>
                <Plus className={`${isMobile ? 'w-5 h-5' : 'w-4 h-4'} mr-2`} />
                {isMobile ? 'Novo' : 'Novo Agendamento'}
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className={`${isMobile ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'}`}>
          {/* Card Agendamentos Hoje */}
          <Link to="/dashboard/appointments">
            <Card className={`border-border/50 bg-card/50 backdrop-blur-sm ${!isMobile ? 'hover:shadow-brand-md' : ''} transition-all duration-300 cursor-pointer touch-target`}>
              <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMobile ? 'pb-2' : 'pb-2'}`}>
                <CardTitle className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-muted-foreground`}>
                  {dashboardStats[0].title}
                </CardTitle>
                <Calendar className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} text-primary`} />
              </CardHeader>
              <CardContent className={isMobile ? 'p-4' : 'p-6'}>
                <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>{dashboardStats[0].value}</div>
                <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-muted-foreground mt-1`}>
                  Ver todos os agendamentos
                </p>
              </CardContent>
            </Card>
          </Link>
          
          {/* Card Receita do Mês */}
          <Card className={`border-border/50 bg-card/50 backdrop-blur-sm ${!isMobile ? 'hover:shadow-brand-md' : ''} transition-all duration-300`}>
            <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMobile ? 'pb-2' : 'pb-2'}`}>
              <CardTitle className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-muted-foreground`}>
                {dashboardStats[1].title}
              </CardTitle>
              <DollarSign className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} text-green-500`} />
            </CardHeader>
            <CardContent className={isMobile ? 'p-4' : 'p-6'}>
              <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>{dashboardStats[1].value}</div>
              <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-muted-foreground mt-1`}>
                Baseado em serviços finalizados
              </p>
            </CardContent>
          </Card>

          {/* Card Equipe */}
          <Link to="/dashboard/team">
            <Card className={`border-border/50 bg-card/50 backdrop-blur-sm ${!isMobile ? 'hover:shadow-brand-md' : ''} transition-all duration-300 cursor-pointer touch-target`}>
              <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMobile ? 'pb-2' : 'pb-2'}`}>
                <CardTitle className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-muted-foreground`}>
                  {dashboardStats[2].title}
                </CardTitle>
                <Users className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} text-blue-500`} />
              </CardHeader>
              <CardContent className={isMobile ? 'p-4' : 'p-6'}>
                <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>{dashboardStats[2].value}</div>
                <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-muted-foreground mt-1`}>
                  Gerenciar funcionários
                </p>
              </CardContent>
            </Card>
          </Link>

          {/* Card Serviços Populares */}
          <Link to="/dashboard/services">
            <Card className={`border-border/50 bg-card/50 backdrop-blur-sm ${!isMobile ? 'hover:shadow-brand-md' : ''} transition-all duration-300 cursor-pointer touch-target`}>
              <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${isMobile ? 'pb-2' : 'pb-2'}`}>
                <CardTitle className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium text-muted-foreground`}>
                  {dashboardStats[3].title}
                </CardTitle>
                <Star className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} text-purple-500`} />
              </CardHeader>
              <CardContent className={isMobile ? 'p-4' : 'p-6'}>
                <div className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold`}>{dashboardStats[3].value}</div>
                <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-muted-foreground mt-1`}>
                  Ver todos os serviços
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className={`grid grid-cols-1 ${!isMobile ? 'lg:grid-cols-3' : ''} gap-6`}>
          {/* Today's Appointments */}
          <Card className={`${!isMobile ? 'lg:col-span-2' : ''} border-border/50 bg-card/50 backdrop-blur-sm`}>
            <CardHeader className={isMobile ? 'p-4' : 'p-6'}>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-lg' : 'text-xl'} font-semibold`}>
                    <Calendar className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-primary`} />
                    {role === 'admin' ? "Agendamentos de Hoje" : "Meus Horários Hoje"}
                  </CardTitle>
                  <CardDescription className={isMobile ? 'text-sm' : ''}>
                    {agendamentosHoje.length} agendamentos programados
                  </CardDescription>
                </div>
                <Button variant="ghost" size={isMobile ? "sm" : "icon"} className="touch-target">
                  <MoreVertical className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className={isMobile ? 'p-4' : 'p-6'}>
              <div className={`space-y-4 ${isMobile ? 'space-y-3' : ''}`}>
                {agendamentosHoje.length === 0 ? (
                  <div className={`text-center ${isMobile ? 'py-6' : 'py-8'} text-muted-foreground`}>
                    <Calendar className={`${isMobile ? 'w-8 h-8' : 'w-12 h-12'} mx-auto mb-4 opacity-50`} />
                    <p className={isMobile ? 'text-sm' : ''}>Nenhum agendamento para hoje</p>
                  </div>
                ) : (
                  agendamentosHoje
                    .sort((a: any, b: any) => {
                      const orderA = statusOrder[a.status] || 99;
                      const orderB = statusOrder[b.status] || 99;
                      if (orderA !== orderB) {
                        return orderA - orderB;
                      }
                      return new Date(a.data_hora).getTime() - new Date(b.data_hora).getTime();
                    })
                    .map((appointment: any) => (
                    <div key={appointment.id} className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'} p-4 border border-border/50 rounded-lg bg-background/50 touch-target`}>
                      <div className="flex-1">
                        <div className={`flex ${isMobile ? 'flex-col gap-1' : 'items-center gap-2'} mb-1`}>
                          <h4 className={`font-medium ${isMobile ? 'text-sm' : ''}`}>{appointment.cliente_nome}</h4>
                          {getStatusBadge(appointment.status)}
                        </div>
                        <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
                          {appointment.servicos?.nome} • {appointment.servicos?.duracao_minutos}min • {appointment.funcionarios?.nome || 'N/A'}
                        </p>
                      </div>
                      <div className={`flex items-center ${isMobile ? 'justify-between' : 'gap-2 text-right'}`}>
                        <div className={isMobile ? 'flex-1' : ''}>
                          <p className={`font-mono ${isMobile ? 'text-base' : 'text-lg'} font-bold`}>{formatTime(appointment.data_hora)}</p>
                          <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>R$ {appointment.servicos?.valor || 0}</p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size={isMobile ? "sm" : "icon"} 
                              disabled={updateStatusMutation.isPending}
                              className="touch-target"
                            >
                              <MoreVertical className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'}`} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleUpdateStatus(appointment.id, 'finalizado')}>
                              Finalizar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleUpdateStatus(appointment.id, 'cancelado')}>
                              Cancelar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions & Stats */}
          <div className={`space-y-6 ${isMobile ? 'space-y-4' : ''}`}>
            {/* Performance Card for Admin */}
            {role === 'admin' && (
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className={isMobile ? 'p-4' : 'p-6'}>
                  <CardTitle className={`flex items-center gap-2 ${isMobile ? 'text-lg' : 'text-xl'} font-semibold`}>
                    <TrendingUp className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-primary`} />
                    Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className={`space-y-4 ${isMobile ? 'p-4 space-y-3' : 'p-6'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>Serviços Populares</span>
                    <Badge variant="secondary" className={isMobile ? 'text-xs px-2 py-1' : ''}>
                      <Star className={`${isMobile ? 'w-2 h-2' : 'w-3 h-3'} mr-1`} />
                      Top 3
                    </Badge>
                  </div>
                  <div className={`space-y-2 ${isMobile ? 'space-y-1' : ''}`}>
                    {stats.servicos_populares.length > 0 ? (
                      stats.servicos_populares.map(servico => (
                        <div key={servico.nome} className={`flex justify-between ${isMobile ? 'text-xs' : 'text-sm'}`}>
                          <span>{servico.nome}</span>
                          <span className="text-muted-foreground">{servico.porcentagem}%</span>
                        </div>
                      ))
                    ) : (
                      <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground text-center ${isMobile ? 'py-3' : 'py-4'}`}>
                        Nenhum agendamento encontrado para calcular.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className={isMobile ? 'p-4' : 'p-6'}>
                <CardTitle className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold`}>Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className={`space-y-4 ${isMobile ? 'p-4 space-y-3' : 'p-6'}`}>
                {role === 'admin' ? (
                  <>
                    <Link to="/dashboard/team">
                      <Button 
                        variant="outline" 
                        className={`w-full justify-start ${isMobile ? 'h-12 text-sm' : ''} touch-target bg-white dark:bg-gray-900 text-black dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800`}
                      >
                        <Plus className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'} mr-2`} />
                        Gerenciar Equipe
                      </Button>
                    </Link>
                    <Link to="/dashboard/services">
                      <Button 
                        variant="outline" 
                        className={`w-full justify-start ${isMobile ? 'h-12 text-sm' : ''} touch-target bg-white dark:bg-gray-900 text-black dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800`}
                      >
                        <Calendar className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'} mr-2`} />
                        Gerenciar Serviços
                      </Button>
                    </Link>
                    <Link to="/dashboard/settings">
                      <Button 
                        variant="outline" 
                        className={`w-full justify-start ${isMobile ? 'h-12 text-sm' : ''} touch-target bg-white dark:bg-gray-900 text-black dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800`}
                      >
                        <Users className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'} mr-2`} />
                        Configurações
                      </Button>
                    </Link>
                    {/* Mostrar opção de pausa se o admin também é funcionário */}
                    {isOwnerEmployee && (
                      <>
                        {isPaused ? (
                          <Button 
                            variant="outline" 
                            className={`w-full justify-start ${isMobile ? 'h-12 text-sm' : ''} touch-target bg-green-50 border-green-200 text-green-700`}
                            onClick={handleMarcarPausa}
                            disabled={removePausaMutation.isPending}
                          >
                            <Clock className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'} mr-2`} />
                            Remover Pausa
                          </Button>
                        ) : (
                          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                className={`w-full justify-start ${isMobile ? 'h-12 text-sm' : ''} touch-target bg-white dark:bg-gray-900 text-black dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800`}
                              >
                                <Clock className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'} mr-2`} />
                                Marcar Pausa
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                              <DialogHeader>
                                <DialogTitle>Marcar Pausa</DialogTitle>
                                <DialogDescription>
                                  Selecione o horário da sua pausa. Os horários disponíveis são baseados no funcionamento da barbearia.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label htmlFor="inicio" className="text-right">
                                    Início
                                  </Label>
                                  <Select
                                    value={pauseData.inicio}
                                    onValueChange={(value) => setPauseData(prev => ({ ...prev, inicio: value }))}
                                  >
                                    <SelectTrigger className="col-span-3">
                                      <SelectValue placeholder="Selecione o horário" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableTimeSlots.map((slot) => (
                                        <SelectItem key={slot} value={slot}>
                                          {slot}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label htmlFor="fim" className="text-right">
                                    Fim
                                  </Label>
                                  <Select
                                    value={pauseData.fim}
                                    onValueChange={(value) => setPauseData(prev => ({ ...prev, fim: value }))}
                                  >
                                    <SelectTrigger className="col-span-3">
                                      <SelectValue placeholder="Selecione o horário" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableTimeSlots
                                        .filter(slot => slot > pauseData.inicio)
                                        .map((slot) => (
                                          <SelectItem key={slot} value={slot}>
                                            {slot}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                  <Label htmlFor="motivo" className="text-right">
                                    Motivo
                                  </Label>
                                  <input
                                    id="motivo"
                                    value={pauseData.motivo}
                                    onChange={(e) => setPauseData(prev => ({ ...prev, motivo: e.target.value }))}
                                    placeholder="Opcional"
                                    className="col-span-3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                                {availableTimeSlots.length === 0 && (
                                  <div className="text-sm text-gray-500 text-center">
                                    Nenhum horário disponível hoje. A barbearia pode estar fechada.
                                  </div>
                                )}
                              </div>
                              <DialogFooter>
                                <Button
                                  type="submit"
                                  onClick={handlePauseSubmit}
                                  disabled={createPausaMutation.isPending || !pauseData.inicio || !pauseData.fim}
                                >
                                  {createPausaMutation.isPending ? 'Marcando...' : 'Marcar Pausa'}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Button 
                      variant="outline" 
                      className={`w-full justify-start ${isMobile ? 'h-12 text-sm' : ''} touch-target bg-white dark:bg-gray-900 text-black dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800`}
                      onClick={handleConfirmarAtendimento}
                    >
                      <CheckCircle className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'} mr-2`} />
                      Confirmar Atendimento
                    </Button>
                    {isPaused ? (
                      <Button 
                        variant="outline" 
                        className={`w-full justify-start ${isMobile ? 'h-12 text-sm' : ''} touch-target bg-green-50 border-green-200 text-green-700`}
                        onClick={handleMarcarPausa}
                        disabled={removePausaMutation.isPending}
                      >
                        <Clock className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'} mr-2`} />
                        Remover Pausa
                      </Button>
                    ) : (
                      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            className={`w-full justify-start ${isMobile ? 'h-12 text-sm' : ''} touch-target bg-white dark:bg-gray-900 text-black dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800`}
                          >
                            <Clock className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'} mr-2`} />
                            Marcar Pausa
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Marcar Pausa</DialogTitle>
                            <DialogDescription>
                              Selecione o horário da sua pausa. Os horários disponíveis são baseados no funcionamento da barbearia.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="inicio" className="text-right">
                                Início
                              </Label>
                              <Select
                                value={pauseData.inicio}
                                onValueChange={(value) => setPauseData(prev => ({ ...prev, inicio: value }))}
                              >
                                <SelectTrigger className="col-span-3">
                                  <SelectValue placeholder="Selecione o horário" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableTimeSlots.map((slot) => (
                                    <SelectItem key={slot} value={slot}>
                                      {slot}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="fim" className="text-right">
                                Fim
                              </Label>
                              <Select
                                value={pauseData.fim}
                                onValueChange={(value) => setPauseData(prev => ({ ...prev, fim: value }))}
                              >
                                <SelectTrigger className="col-span-3">
                                  <SelectValue placeholder="Selecione o horário" />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableTimeSlots
                                    .filter(slot => slot > pauseData.inicio)
                                    .map((slot) => (
                                      <SelectItem key={slot} value={slot}>
                                        {slot}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="motivo" className="text-right">
                                Motivo
                              </Label>
                              <input
                                id="motivo"
                                value={pauseData.motivo}
                                onChange={(e) => setPauseData(prev => ({ ...prev, motivo: e.target.value }))}
                                placeholder="Opcional"
                                className="col-span-3 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            {availableTimeSlots.length === 0 && (
                              <div className="text-sm text-gray-500 text-center">
                                Nenhum horário disponível hoje. A barbearia pode estar fechada.
                              </div>
                            )}
                          </div>
                          <DialogFooter>
                            <Button
                              type="submit"
                              onClick={handlePauseSubmit}
                              disabled={createPausaMutation.isPending || !pauseData.inicio || !pauseData.fim}
                            >
                              {createPausaMutation.isPending ? 'Marcando...' : 'Marcar Pausa'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                    <Button 
                      variant="outline" 
                      className={`w-full justify-start ${isMobile ? 'h-12 text-sm' : ''} touch-target bg-white dark:bg-gray-900 text-black dark:text-white border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800`}
                      onClick={handleVerFeedback}
                    >
                      <Star className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'} mr-2`} />
                      Ver Feedback
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}