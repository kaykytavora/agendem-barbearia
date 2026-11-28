/**
 * NOTA: Validação OTP temporariamente desabilitada
 * 
 * A verificação por OTP foi desativada até que a API de envio de SMS seja implementada.
 * O fluxo de agendamento anônimo funciona normalmente, mas pula a etapa de verificação.
 * 
 * Para reativar:
 * 1. Implementar API de envio de SMS
 * 2. Descomentar as linhas marcadas com "TODO: Reativar quando API de SMS estiver disponível"
 * 3. Remover os comentários e condições "false &&" nas renderizações do OTP
 */

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Phone,
  Mail,
  User,
  Loader2,
  CalendarIcon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { usePhoneMask } from "@/hooks/usePhoneMask";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { OTPVerification } from "@/components/OTPVerification";
import { toStringSafe, onlyDigits, normalizeToE164, formatBRL, whatsAppUrl, enderecoCompleto } from "@/lib/utils";
import { anonymousBookingSchema } from "@/hooks/useInputValidation";
import { generatePDFReceipt } from "@/lib/receipt";
import { useBarbershopDetails } from "@/hooks/useBarbershopDetails";
import { dataLocalISO, gerarHorarios, horaNoDia, ocupacoesDoDia, pausasDoDia, type Horario } from "@/lib/agenda";
import { BookingStepper, type StepperStep } from "@/components/booking/BookingStepper";
import { ServiceList } from "@/components/booking/ServiceList";
import { DayPicker } from "@/components/booking/DayPicker";
import { ProfessionalPicker } from "@/components/booking/ProfessionalPicker";
import { TimeSlotGrid } from "@/components/booking/TimeSlotGrid";
import { BookingSummaryBar } from "@/components/booking/BookingSummaryBar";
import { BookingConfirmationCard } from "@/components/booking/BookingConfirmationCard";
import { ShopHeroCard } from "@/components/barbershop/ShopHeroCard";
import { ShopInfoAside } from "@/components/barbershop/ShopInfoAside";
import { FotoLightbox } from "@/components/barbershop/FotoLightbox";
import { ProgramaSelosPublico, AvisoSelosSemLogin } from "@/components/barbershop/ProgramaSelosPublico";
import { caminhoAgendamento, createAppointment } from "@/integrations/supabase/api";


type Servico = Database['public']['Tables']['servicos']['Row'];
type Funcionario = Pick<Database['public']['Tables']['funcionarios']['Row'], 'id' | 'nome'>;
type HorarioFuncionamento = Database['public']['Tables']['horarios_funcionamento']['Row'];

type BookingStep = StepperStep | 'otp' | 'confirmation';

const BarberShopDetails = () => {
  const { slug } = useParams(); // Changed from id to slug
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth(); // Usar o perfil do contexto

  // Booking flow state
  const isOTPEnabled = false; // Temporarily disabled until SMS API is ready
  const [currentStep, setCurrentStep] = useState<BookingStep>('service');
  const [fotoAberta, setFotoAberta] = useState<number | null>(null);
  // Direção da transição entre etapas (avançar entra pela direita, voltar pela esquerda)
  const stepAnim = useRef<{ step: BookingStep; dir: 'forward' | 'back' }>({ step: 'service', dir: 'forward' });
  if (stepAnim.current.step !== currentStep) {
    const ordem: BookingStep[] = ['service', 'professional', 'datetime', 'client', 'otp', 'confirmation'];
    stepAnim.current = {
      step: currentStep,
      dir: ordem.indexOf(currentStep) < ordem.indexOf(stepAnim.current.step) ? 'back' : 'forward',
    };
  }
  // Serviços na ordem em que a pessoa marcou; são feitos em sequência, um logo após o outro
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [professionalChoice, setProfessionalChoice] = useState<string | null>();
  const selectedBarber = professionalChoice ?? null;
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [clientData, setClientData] = useState({
    name: '',
    phone: '',
    email: '',
    createAccount: false
  });
  const [lastCreatedAppointment, setLastCreatedAppointment] = useState<any>(null);
  const [isClientLoggedIn, setIsClientLoggedIn] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const { value: phoneValue, handleChange, handleBlur } = usePhoneMask(clientData.phone || '');

  // Dados da barbearia (React Query): serviços, equipe, horários, agendamentos futuros e avaliações
  const { data: dados, dataUpdatedAt, isLoading: loading, isError: loadError, refetch: refetchBarbershop } = useBarbershopDetails(slug);
  const barbershop = dados?.barbershop ?? null;
  const feedbacks = dados?.feedbacks ?? [];
  const ausencias = dados?.ausencias ?? [];
  const stats = dados?.stats ?? {
    totalFuncionarios: 0,
    mediaAvaliacoes: 0,
    totalAvaliacoes: 0,
    isOpen: false,
    horarioFormatado: '',
    diasFormatado: ''
  };
  const [submitting, setSubmitting] = useState(false);
  const selectedServicesData: Servico[] = selectedServices
    .map((id) => barbershop?.servicos.find((s: Servico) => s.id === id))
    .filter((s): s is Servico => !!s);
  const selectedNames = selectedServicesData.map((s) => s.nome).join(' + ');
  const selectedTotal = selectedServicesData.reduce((t, s) => t + Number(s.valor), 0);
  // A disponibilidade considera o bloco inteiro (todos os serviços seguidos)
  const selectedDuration = selectedServicesData.reduce((t, s) => t + s.duracao_minutos, 0) || 30;

  useEffect(() => {
    if (profile) {
      setClientData(prev => ({
        ...prev,
        name: profile.name || '',
        phone: profile.phone || '', // A fonte da verdade para o hook
        email: user?.email || '',
      }));
      setIsClientLoggedIn(true);
    }
  }, [profile, user]);

  // Generate available dates for the next 30 days
  const generateAvailableDates = (funcionarioId: string | null = null) => {
    const dates = [];
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      // Check if this day is available based on horarios_funcionamento
      const dayOfWeek = date.getDay();
      const workingHours = barbershop?.horarios_funcionamento.find((h: HorarioFuncionamento) => h.dia_semana === dayOfWeek);

      if (workingHours && !workingHours.fechado) {
        // Check for absences
        let isAbsent = false;
        if (funcionarioId && ausencias.length > 0) {
          const dateStr = dataLocalISO(date);
          isAbsent = ausencias.some((a: any) =>
            a.funcionario_id === funcionarioId &&
            a.data_inicio <= dateStr &&
            a.data_fim >= dateStr
          );
        }

        if (!isAbsent) {
          dates.push(date);
        }
      }
    }

    return dates;
  };

  // Gera os horários do dia para o serviço escolhido (e o profissional, se houver)
  async function generateTimeSlots(date: Date, signal: AbortSignal): Promise<Horario[]> {
    if (!barbershop) return [];

    const workingHours = barbershop.horarios_funcionamento.find((h: HorarioFuncionamento) => h.dia_semana === date.getDay());
    if (!workingHours || workingHours.fechado || !workingHours.hora_abre || !workingHours.hora_fecha) {
      return [];
    }

    // Profissional de férias/ausente nesse dia não tem horários
    if (selectedBarber) {
      const dia = dataLocalISO(date);
      const { data: ausenciasDoDia, error } = await supabase
        .from('funcionario_ausencias')
        .select('id')
        .eq('funcionario_id', selectedBarber)
        .lte('data_inicio', dia)
        .gte('data_fim', dia)
        .abortSignal(signal);
      if (error) throw error;
      if (ausenciasDoDia && ausenciasDoDia.length > 0) return [];
    }

    const ocupados = [
      ...ocupacoesDoDia(barbershop.horarios_ocupados, date, selectedBarber),
      ...pausasDoDia(barbershop.pausas, date, selectedBarber, barbershop.funcionarios.length),
    ];

    return gerarHorarios({
      abre: horaNoDia(date, workingHours.hora_abre),
      fecha: horaNoDia(date, workingHours.hora_fecha),
      duracaoMin: selectedDuration,
      ocupados,
    });
  }

  const {
    data: timeSlots = [],
    isPending: calculandoHorarios,
    isError: erroHorarios,
    refetch: recarregarHorarios,
  } = useQuery({
    queryKey: ["horarios-reserva", barbershop?.id, dataUpdatedAt, selectedDate && dataLocalISO(selectedDate), selectedBarber, selectedDuration],
    queryFn: ({ signal }) => selectedDate ? generateTimeSlots(selectedDate, signal) : [],
    enabled: Boolean(barbershop && selectedDate),
  });
  const horarioDisponivel = !erroHorarios && timeSlots.some(({ time, isAvailable }) => time === selectedTime && isAvailable);

  const handleNextStep = () => {
    if (currentStep === 'service' && selectedServices.length > 0) {
      setCurrentStep('professional');
    } else if (currentStep === 'professional' && professionalChoice !== undefined) {
      setCurrentStep('datetime');
    } else if (currentStep === 'datetime' && selectedDate && horarioDisponivel) {
      setCurrentStep('client');
    } else if (currentStep === 'client' && clientData.name && clientData.phone) {
      // Validar dados do cliente com Zod antes de prosseguir
      try {
        const validatedData = anonymousBookingSchema.parse({
          name: toStringSafe(clientData.name),
          phone: toStringSafe(clientData.phone)
          // otp removido temporariamente - será reativado com API de SMS
        });

        const cleanedPhone = onlyDigits(validatedData.phone);
        if (cleanedPhone.length < 10 || cleanedPhone.length > 11) {
          toast({
            title: "Telefone inválido",
            description: "O telefone deve ter entre 10 e 11 dígitos.",
            variant: "destructive",
          });
          return;
        }
      } catch (error: any) {
        toast({
          title: "Dados inválidos",
          description: error.errors?.[0]?.message || "Verifique os dados informados.",
          variant: "destructive",
        });
        return;
      }

      // Se usuário está logado, vai direto para confirmação
      if (isClientLoggedIn) {
        handleBookingSubmit();
      } else {
        // TEMPORÃRIO: Pular OTP até implementar API de SMS
        // TODO: Reativar quando API de SMS estiver disponível
        // setCurrentStep('otp');
        handleBookingSubmit();
      }
    } else if (currentStep === 'otp' && customerId) {
      // TEMPORÃRIO: Esta condição não será executada enquanto OTP estiver desabilitado
      handleBookingSubmit();
    }
  };

  const handleBookingSubmit = async () => {
    if (!barbershop || selectedServicesData.length === 0 || !selectedDate || !selectedTime) return;

    setSubmitting(true);

    try {
      // Validação e normalização segura dos dados do cliente
      const safeName = toStringSafe(clientData.name);
      const safePhone = toStringSafe(clientData.phone);
      const safeEmail = toStringSafe(clientData.email);

      if (!safeName || !safePhone) {
        toast({
          title: "Erro",
          description: "Nome e telefone são obrigatórios.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Validate email when account creation is requested
      if (clientData.createAccount && !safeEmail) {
        toast({
          title: "Erro",
          description: "E-mail é obrigatório para criar uma conta.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // Validate email format when provided
      if (safeEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
        toast({
          title: "Erro",
          description: "Por favor, insira um e-mail válido.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      let cleanedPhone: string;
      try {
        cleanedPhone = onlyDigits(safePhone);
        // Validar formato do telefone
        normalizeToE164(cleanedPhone, 'BR');
      } catch (error: any) {
        console.error('[PHONE_NORMALIZE_ERROR]', {
          raw: safePhone,
          typeof: typeof safePhone,
          error: error.message
        });
        toast({
          title: "Telefone inválido",
          description: "Formato de telefone inválido. Use apenas números.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      // VERIFICAÇÃƒO DE LIMITE DE AGENDAMENTO (versão mais robusta)
      const { data: activeBookings, error: fetchError } = await supabase
        .from('agendamentos')
        .select('id, status, barbearia_id, data_hora')
        .eq('cliente_telefone', cleanedPhone)
        .in('status', ['pendente', 'confirmado']);

      if (fetchError) {
        throw new Error("Não foi possível verificar seus agendamentos existentes.");
      }

      // O limite é de 3 visitas ativas. Uma combinação (corte + luzes) gera vários registros
      // no mesmo dia, mas conta como uma visita só.
      const visitasAtivas = new Set((activeBookings ?? []).map((a) => `${a.barbearia_id}|${dataLocalISO(new Date(a.data_hora))}`)).size;
      if (visitasAtivas >= 3) {
        toast({
          title: "Limite de agendamentos atingido",
          description: `Você já possui ${visitasAtivas} agendamentos ativos e o limite é 3. Finalize ou cancele um para poder marcar outro.`,
          variant: "destructive",
          duration: 6000
        });
        setSubmitting(false);
        return;
      }

      // 1. Combine date and time into a single timestamp
      const [hours, minutes] = selectedTime.split(':');
      const appointmentDateTime = new Date(selectedDate);
      appointmentDateTime.setHours(parseInt(hours, 10));
      appointmentDateTime.setMinutes(parseInt(minutes, 10));
      appointmentDateTime.setSeconds(0, 0); // Zera segundos e milissegundos

      // 2. Um agendamento por serviço, em sequência: corte às 10:00 (30 min) → luzes às 10:30
      let inicio = appointmentDateTime.getTime();
      const criados = [];
      // Serviços escolhidos juntos formam um único atendimento
      const grupoId = selectedServicesData.length > 1 ? crypto.randomUUID() : undefined;
      for (const servico of selectedServicesData) {
        const bookingData = {
          barbearia_id: barbershop.id,
          servico_id: servico.id,
          funcionario_id: selectedBarber,
          grupo_id: grupoId,
          data_hora: new Date(inicio).toISOString(),
          cliente_nome: safeName,
          cliente_telefone: cleanedPhone, // Salva apenas os dígitos
          cliente_email: safeEmail || null,
          avaliado: false,
          // Sempre enviar user_id explicitamente - null para anônimos, user.id para logados
          user_id: isClientLoggedIn && user ? user.id : null,
          // Adicionar customer_id se disponível (usuário não logado com OTP verificado)
          ...(customerId && { customer_id: customerId })
        };

        const criado = await createAppointment(bookingData, { carregarDetalhes: false }).catch(async (error: unknown) => {
          if (error instanceof Error && error.message.startsWith("Esse horário já está reservado")) {
            await refetchBarbershop();
          }
          // Se parte da combinação já foi marcada, avisa quais serviços ficaram reservados
          if (criados.length > 0 && error instanceof Error) {
            const feitos = selectedServicesData.slice(0, criados.length).map((s) => s.nome).join(', ');
            throw new Error(`${error.message} Os serviços ${feitos} foram agendados; ${servico.nome} não.`);
          }
          throw error;
        });
        criados.push(criado);
        inicio += servico.duracao_minutos * 60_000;
      }
      const data = criados[0];

      // Para usuários anônimos, não tentamos buscar dados completos via RLS
      // pois eles não têm permissão de leitura
      if (isClientLoggedIn) {
        // Buscar dados completos do agendamento para o comprovante (apenas para usuários logados)
        const { data: fullAppointmentData, error: fetchDataError } = await supabase
          .from('agendamentos')
          .select(`
            *,
            servicos:servico_id (nome, valor, duracao_minutos),
            funcionarios:funcionario_id (nome),
            barbearias:barbearia_id (nome, endereco, telefone)
          `)
          .eq('id', data!.id)
          .single();

        if (fetchDataError) {
          console.error("Erro ao buscar dados completos do agendamento:", fetchDataError);
          setLastCreatedAppointment(data);
        } else {
          // O comprovante mostra a combinação inteira
          setLastCreatedAppointment({
            ...fullAppointmentData,
            servicos: { nome: selectedNames, valor: selectedTotal, duracao_minutos: selectedDuration },
          });
        }
      } else {
        // Para anônimos, construir dados completos manualmente usando dados que já temos
        const fullData = {
          ...data,
          servicos: { nome: selectedNames, valor: selectedTotal, duracao_minutos: selectedDuration },
          funcionarios: selectedBarber
            ? { nome: barbershop.funcionarios?.find((f: any) => f.id === selectedBarber)?.nome || 'Qualquer profissional' }
            : null,
          barbearias: {
            nome: barbershop.nome,
            endereco: barbershop.endereco,
            telefone: barbershop.telefone
          }
        };
        setLastCreatedAppointment(fullData);
      }

      // Em vez de atualizar o estado local, vamos chamar a função de recarregamento
      // para garantir que todos os dados (incluindo o novo agendamento) estejam atualizados.
      await refetchBarbershop();

      // Handle account creation if checked (only for anonymous users who want to create account)
      if (!isClientLoggedIn && clientData.createAccount && clientData.email) {

        // Por enquanto, apenas informamos que a funcionalidade está em desenvolvimento
        // TODO: Implementar criação de conta real quando Edge Function estiver funcionando
        toast({
          title: "Conta será criada! ðŸ“",
          description: `Agendamento confirmado para ${clientData.name}. A funcionalidade de criação automática de conta está sendo finalizada. Por enquanto, você pode criar sua conta manualmente na página de registro.`,
          duration: 10000,
        });
      }

      setCurrentStep('confirmation');

    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível confirmar o agendamento. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Function to download appointment receipt
  const handleDownloadReceipt = async () => {
    if (!lastCreatedAppointment) return;

    const appointmentData = {
      id: lastCreatedAppointment.id,
      cliente_nome: lastCreatedAppointment.cliente_nome,
      cliente_telefone: lastCreatedAppointment.cliente_telefone,
      cliente_email: lastCreatedAppointment.cliente_email,
      data_hora: lastCreatedAppointment.data_hora,
      status: lastCreatedAppointment.status,
      servico: lastCreatedAppointment.servicos || (selectedServicesData.length
        ? { nome: selectedNames, valor: selectedTotal, duracao_minutos: selectedDuration }
        : { nome: 'Serviço não identificado', valor: 0, duracao_minutos: 0 }),
      funcionario: lastCreatedAppointment.funcionarios || {
        nome: 'A definir'
      },
      barbearia: lastCreatedAppointment.barbearias || {
        nome: barbershop?.nome || 'Barbearia',
        endereco: barbershop?.endereco,
        telefone: barbershop?.telefone,
        logo_url: barbershop?.logo_url
      }
    };

    await generatePDFReceipt(appointmentData);
  };

  // Check if user is anonymous and didn't create account
  // Usuário anônimo é aquele que não estava logado E não criou conta durante o processo

  // Helper functions for social media links
  const formatWhatsAppLink = (phone: string, barbershopName: string) =>
    whatsAppUrl(phone, `Olá! Vi o perfil da ${barbershopName} e gostaria de agendar um horário.`);

  const formatInstagramLink = (instagram: string) => {
    // Remove @ and clean the username
    const cleanUsername = instagram.replace(/[@\s]/g, '');
    return `https://instagram.com/${cleanUsername}`;
  };

  // Callbacks para o componente OTPVerification
  const handleOTPVerified = (verifiedCustomerId: string) => {
    setCustomerId(verifiedCustomerId);
    // Automaticamente avança para o próximo passo
    setTimeout(() => {
      setCurrentStep('confirmation');
      handleBookingSubmit();
    }, 1000);
  };

  const handleOTPBack = () => {
    setCurrentStep('client');
    setCustomerId(null);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center">
        <div className="flex items-center gap-3 text-lg">
          <Loader2 className="w-6 h-6 animate-spin" />
          Carregando barbearia...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-bold">Não foi possível carregar a barbearia</h2>
          <p className="text-muted-foreground">Verifique sua conexão e tente novamente.</p>
          <Button onClick={() => refetchBarbershop()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  if (!barbershop) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-bold">Barbearia não encontrada</h2>
          <Button onClick={() => navigate('/barbearias')}>
            Voltar para listagem
          </Button>
        </div>
      </div>
    );
  }

  const availableDates = generateAvailableDates(selectedBarber);
  const galleryImages: string[] = (barbershop.gallery_urls || []).filter(Boolean);
  const endereco = enderecoCompleto(barbershop);
  const selectedBarberName = barbershop.funcionarios.find((b: Funcionario) => b.id === selectedBarber)?.nome;
  const isStaff = !!profile?.role && profile.role !== 'cliente';

  // Texto do resumo fixo no rodapé do agendamento
  const summaryTitle = selectedNames || 'Escolha um ou mais serviços';
  const summarySubtitle = [
    selectedServicesData.length > 0 && `${formatBRL(selectedTotal)} · ${selectedDuration} min`,
    professionalChoice !== undefined && (selectedBarberName ?? 'Qualquer profissional'),
    selectedDate?.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''),
    currentStep === 'datetime' && !horarioDisponivel ? null : selectedTime,
  ].filter(Boolean).join(' · ');

  const summaryAction = {
    service: { label: 'Continuar', disabled: selectedServices.length === 0 },
    professional: { label: 'Continuar', disabled: professionalChoice === undefined },
    datetime: { label: 'Continuar', disabled: !selectedDate || !horarioDisponivel },
    client: { label: 'Confirmar', disabled: !clientData.name || !clientData.phone },
    otp: { label: 'Continuar', disabled: true },
    confirmation: { label: '', disabled: true },
  }[currentStep];

  const goBack = () => {
    if (currentStep === 'professional') setCurrentStep('service');
    if (currentStep === 'datetime') setCurrentStep('professional');
    if (currentStep === 'client') setCurrentStep('datetime');
  };

  const resetBooking = () => {
    setCurrentStep('service');
    setSelectedServices([]);
    setProfessionalChoice(undefined);
    setSelectedDate(null);
    setSelectedTime(null);
    setLastCreatedAppointment(null);
    // Se o usuário estiver logado, repopula os dados, senão, limpa.
    if (profile) {
      setClientData({
        name: profile.name || '',
        phone: profile.phone || '',
        email: user?.email || '',
        createAccount: false,
      });
    } else {
      setClientData({ name: '', phone: '', email: '', createAccount: false });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Button variant="outline" size="icon" onClick={() => navigate('/barbearias')} aria-label="Voltar para a lista de barbearias">
            <ArrowLeft />
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-5">
        <ShopHeroCard
          nome={barbershop.nome}
          logoUrl={barbershop.logo_url}
          endereco={endereco}
          stats={stats}
          whatsAppHref={barbershop.telefone ? formatWhatsAppLink(barbershop.telefone, barbershop.nome) : undefined}
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          {/* Agendamento */}
          <section aria-label="Agendar horário" className="min-w-0">
            {currentStep !== 'confirmation' && currentStep !== 'otp' && (
              <div className="mb-4">
                <BookingStepper current={currentStep} onStepClick={(step) => setCurrentStep(step)} />
              </div>
            )}

            <div key={currentStep} className={stepAnim.current.dir === 'back' ? 'step-enter-back' : 'step-enter-forward'}>
            {currentStep === 'service' && (
              <div className="space-y-4">
                <div className="rounded-3xl border border-border/60 bg-card p-4 shadow-brand-md sm:p-6">
                  <h2 className="text-xl font-bold">Escolha os serviços</h2>
                  <p className="mb-4 text-sm text-muted-foreground">Pode marcar mais de um — eles são feitos em sequência.</p>
                  {barbershop.servicos.length === 0 ? (
                    <div className="flex flex-col items-center rounded-2xl border border-dashed border-input px-4 py-10 text-center">
                      <CalendarIcon className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
                      <p className="font-semibold">Agendamento online indisponível</p>
                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        Esta barbearia ainda não cadastrou serviços.
                        {barbershop.telefone ? ' Fale com ela pelo WhatsApp para marcar seu horário.' : ' Volte mais tarde.'}
                      </p>
                    </div>
                  ) : (
                    <ServiceList services={barbershop.servicos} selectedIds={selectedServices} onToggle={(id) => {
                      // A duração total muda, então o horário escolhido pode deixar de caber
                      setSelectedTime(null);
                      setSelectedServices((atual) => atual.includes(id) ? atual.filter((s) => s !== id) : [...atual, id]);
                    }} />
                  )}
                </div>
              </div>
            )}

            {currentStep === 'professional' && (
              <Card variant="glass" className="rounded-3xl border-border/60 shadow-brand-md">
                <CardContent className="space-y-4 p-3.5 sm:p-6">
                  <h2 className="text-xl font-bold">Escolha o profissional</h2>
                  <ProfessionalPicker professionals={barbershop.funcionarios} selectedId={professionalChoice} onSelect={(id) => {
                    if (id !== professionalChoice) {
                      setSelectedDate(null);
                      setSelectedTime(null);
                    }
                    setProfessionalChoice(id);
                  }} />
                </CardContent>
              </Card>
            )}

            {currentStep === 'datetime' && (
              <Card variant="glass" className="rounded-3xl border-border/60 shadow-brand-md">
                <CardContent className="space-y-5 divide-y divide-border/70 p-3.5 sm:p-6">
                  <section aria-labelledby="reserva-dia">
                    <h2 id="reserva-dia" className="mb-3 text-xl font-bold">Escolha o dia</h2>
                    <DayPicker dates={availableDates} selected={selectedDate} onSelect={(dia) => {
                      if (!selectedDate || dataLocalISO(dia) !== dataLocalISO(selectedDate)) setSelectedTime(null);
                      setSelectedDate(dia);
                    }} />
                  </section>

                  <section aria-labelledby="reserva-horarios" aria-busy={Boolean(selectedDate && calculandoHorarios)} className="pt-5">
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <h2 id="reserva-horarios" className="text-base font-semibold">Horários</h2>
                      {selectedDate && (
                        <span className="text-sm capitalize text-muted-foreground">
                          {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                    {!selectedDate ? (
                      <p className="rounded-2xl border border-dashed border-input p-4 text-center text-sm text-muted-foreground">
                        Escolha um dia para ver os horários.
                      </p>
                    ) : erroHorarios ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border p-3">
                        <p role="alert" className="text-sm text-destructive">Não foi possível consultar os horários.</p>
                        <Button type="button" size="sm" variant="outline" onClick={() => void recarregarHorarios()}>Tentar novamente</Button>
                      </div>
                    ) : calculandoHorarios ? (
                      <p role="status" className="flex items-center justify-center gap-2 rounded-2xl border border-border p-4 text-sm text-muted-foreground">
                        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Consultando horários...
                      </p>
                    ) : (
                      <>
                        <TimeSlotGrid slots={timeSlots} selected={selectedTime} onSelect={setSelectedTime} />
                        {timeSlots.some((s) => !s.isAvailable) && (
                          <p className="mt-3 text-xs text-muted-foreground">
                            Só aparecem livres os horários em que cabem os {selectedDuration} min seguidos
                            {selectedServicesData.length > 1 ? ' de todos os serviços escolhidos' : ''}.
                            Horários indisponíveis já têm alguém marcado nesse intervalo.
                          </p>
                        )}
                      </>
                    )}
                  </section>
                </CardContent>
              </Card>
            )}

            {currentStep === 'client' && (
              <div className="space-y-4 rounded-3xl border border-border/60 bg-card p-4 shadow-brand-md sm:p-6">
                <h2 className="text-xl font-bold">Seus dados</h2>
                {!isClientLoggedIn && <AvisoSelosSemLogin barbeariaId={barbershop.id} />}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome completo</Label>
                    <div className="relative">
                      <Input
                        id="name"
                        value={clientData.name}
                        onChange={(e) => setClientData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Seu nome completo"
                        autoComplete="name"
                        className="h-12 pl-10"
                        disabled={isClientLoggedIn}
                      />
                      <User className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone (WhatsApp)</Label>
                    <div className="relative">
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={toStringSafe(phoneValue)}
                        onChange={(e) => {
                          handleChange(e);
                          setClientData(prev => ({ ...prev, phone: onlyDigits(toStringSafe(e.target.value)) }));
                        }}
                        onBlur={handleBlur}
                        placeholder="(11) 91234-5678"
                        maxLength={15}
                        className="h-12 pl-10"
                        disabled={isClientLoggedIn}
                      />
                      <Phone className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail {clientData.createAccount ? '' : '(opcional)'}</Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={toStringSafe(clientData.email)}
                      onChange={(e) => setClientData(prev => ({ ...prev, email: toStringSafe(e.target.value) }))}
                      placeholder="seu@email.com"
                      className="h-12 pl-10"
                      required={clientData.createAccount}
                      aria-invalid={clientData.createAccount && !clientData.email}
                    />
                    <Mail className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                </div>

                {!isClientLoggedIn && (
                  <div className="flex items-start gap-3 rounded-2xl bg-secondary p-4">
                    <Checkbox
                      id="createAccount"
                      checked={clientData.createAccount}
                      onCheckedChange={(checked) => setClientData(prev => ({ ...prev, createAccount: checked as boolean }))}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="createAccount" className="leading-none">Criar conta para agendar mais rápido</Label>
                      <p className="text-sm text-muted-foreground">Veja seu histórico e acompanhe seus agendamentos.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Verificação por OTP - TEMPORARIAMENTE DESABILITADO */}
            {/* TODO: Reativar quando API de SMS estiver disponível */}
            {isOTPEnabled && currentStep === 'otp' && (
              <div className="rounded-3xl border bg-card p-4 sm:p-6">
                <OTPVerification
                  phone={clientData.phone}
                  name={clientData.name}
                  onVerified={handleOTPVerified}
                  onBack={handleOTPBack}
                />
              </div>
            )}

            {currentStep === 'confirmation' && (
              <BookingConfirmationCard
                shopName={barbershop.nome}
                detalhes={[
                  { rotulo: selectedServicesData.length > 1 ? 'Serviços' : 'Serviço', valor: selectedNames },
                  { rotulo: 'Data', valor: selectedDate && formatDate(selectedDate) },
                  { rotulo: 'Horário', valor: selectedTime },
                  { rotulo: 'Profissional', valor: selectedBarberName },
                  { rotulo: 'Valor', valor: selectedServicesData.length > 0 && formatBRL(selectedTotal) },
                ]}
                canDownload={!!lastCreatedAppointment}
                onDownload={handleDownloadReceipt}
                panelAction={
                  !isClientLoggedIn
                    ? lastCreatedAppointment?.booking_token ? {
                        label: 'Acompanhar meu agendamento',
                        onClick: () => navigate(caminhoAgendamento(lastCreatedAppointment.id, lastCreatedAppointment.booking_token)),
                      } : undefined
                    : {
                        label: isStaff ? 'Voltar para o painel' : 'Ver meus agendamentos',
                        onClick: () => navigate(isStaff ? '/dashboard' : '/meus-agendamentos'),
                      }
                }
                onReset={resetBooking}
                onHome={() => navigate(isClientLoggedIn ? (isStaff ? '/dashboard' : '/client-panel') : '/')}
              />
            )}
            </div>

            {(currentStep === 'service' || currentStep === 'professional' || currentStep === 'datetime' || currentStep === 'client') && barbershop.servicos.length > 0 && (
              <BookingSummaryBar
                title={summaryTitle}
                subtitle={summarySubtitle || undefined}
                actionLabel={summaryAction.label}
                actionDisabled={summaryAction.disabled}
                loading={submitting}
                onAction={handleNextStep}
                onBack={currentStep === 'service' ? undefined : goBack}
              />
            )}
            {currentStep !== 'confirmation' && (
              <ProgramaSelosPublico className="mt-6" barbeariaId={barbershop.id} servicos={barbershop.servicos} semLogin={!isClientLoggedIn} />
            )}
          </section>

          <FotoLightbox fotos={galleryImages} nome={barbershop.nome} index={fotoAberta} onIndexChange={setFotoAberta} />
          {/* Informações da barbearia */}
          <ShopInfoAside
            nome={barbershop.nome}
            descricao={barbershop.descricao}
            instagramHref={barbershop.instagram ? formatInstagramLink(barbershop.instagram) : undefined}
            facebookHref={barbershop.facebook}
            fotos={galleryImages}
            onOpenFoto={setFotoAberta}
            horarios={barbershop.horarios_funcionamento}
            feedbacks={feedbacks}
          />
        </div>
      </main>
    </div>
  );
};

export default BarberShopDetails;
