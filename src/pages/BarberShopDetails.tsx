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

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
import { toStringSafe, onlyDigits, normalizeToE164, formatBRL, shopThemeStyle, whatsAppUrl, enderecoCompleto } from "@/lib/utils";
import { anonymousBookingSchema } from "@/hooks/useInputValidation";
import { generatePDFReceipt } from "@/lib/receipt";
import { useBarbershopDetails } from "@/hooks/useBarbershopDetails";
import { dataLocalISO, gerarHorarios, horaNoDia, ocupacoesDoDia, pausasDoDia, type Horario } from "@/lib/agenda";
import { BookingStepper } from "@/components/booking/BookingStepper";
import { ServiceList } from "@/components/booking/ServiceList";
import { DayPicker } from "@/components/booking/DayPicker";
import { ProfessionalPicker } from "@/components/booking/ProfessionalPicker";
import { TimeSlotGrid } from "@/components/booking/TimeSlotGrid";
import { BookingSummaryBar } from "@/components/booking/BookingSummaryBar";
import { BookingConfirmationCard } from "@/components/booking/BookingConfirmationCard";
import { ShopHeroCard } from "@/components/barbershop/ShopHeroCard";
import { ShopInfoAside } from "@/components/barbershop/ShopInfoAside";


type Servico = Database['public']['Tables']['servicos']['Row'];
type Funcionario = Pick<Database['public']['Tables']['funcionarios']['Row'], 'id' | 'nome'>;
type HorarioFuncionamento = Database['public']['Tables']['horarios_funcionamento']['Row'];

type BookingStep = 'service' | 'datetime' | 'client' | 'otp' | 'confirmation';

const BarberShopDetails = () => {
  const { slug } = useParams(); // Changed from id to slug
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth(); // Usar o perfil do contexto

  // Booking flow state
  const isOTPEnabled = false; // Temporarily disabled until SMS API is ready
  const [currentStep, setCurrentStep] = useState<BookingStep>('service');
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedBarber, setSelectedBarber] = useState<string | null>(null);
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
  const { data: dados, isLoading: loading, isError: loadError, refetch: refetchBarbershop } = useBarbershopDetails(slug);
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
  const [timeSlots, setTimeSlots] = useState<Horario[]>([]);

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
  const generateTimeSlots = useCallback(async (date: Date, funcionarioId: string | null = null, duracaoMin = 30) => {
    if (!barbershop || !date) return [];

    const workingHours = barbershop.horarios_funcionamento.find((h: HorarioFuncionamento) => h.dia_semana === date.getDay());
    if (!workingHours || workingHours.fechado || !workingHours.hora_abre || !workingHours.hora_fecha) {
      return [];
    }

    // Profissional de férias/ausente nesse dia não tem horários
    if (funcionarioId) {
      const dia = dataLocalISO(date);
      const { data: ausenciasDoDia } = await supabase
        .from('funcionario_ausencias')
        .select('id')
        .eq('funcionario_id', funcionarioId)
        .lte('data_inicio', dia)
        .gte('data_fim', dia);
      if (ausenciasDoDia && ausenciasDoDia.length > 0) return [];
    }

    const ocupados = [
      ...ocupacoesDoDia(barbershop.horarios_ocupados, date, funcionarioId),
      ...pausasDoDia(barbershop.pausas, date, funcionarioId, barbershop.funcionarios.length),
    ];

    return gerarHorarios({
      abre: horaNoDia(date, workingHours.hora_abre),
      fecha: horaNoDia(date, workingHours.hora_fecha),
      duracaoMin,
      ocupados,
    });
  }, [barbershop]);

  const handleNextStep = () => {
    if (currentStep === 'service' && selectedService) {
      setCurrentStep('datetime');
    } else if (currentStep === 'datetime' && selectedDate && selectedTime) {
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
    if (!barbershop || !selectedService || !selectedDate || !selectedTime) return;

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
        .select('id, status')
        .eq('cliente_telefone', cleanedPhone)
        .in('status', ['pendente', 'confirmado']);

      if (fetchError) {
        throw new Error("Não foi possível verificar seus agendamentos existentes.");
      }

      if (activeBookings && activeBookings.length >= 3) {
        toast({
          title: "Limite de agendamentos atingido",
          description: "Você já possui 2 agendamentos ativos. Finalize ou cancele um agendamento para poder marcar outro.",
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

      // 2. Prepare the data for insertion, cleaning the phone number
      const bookingData: Database['public']['Tables']['agendamentos']['Insert'] = {
        barbearia_id: barbershop.id,
        servico_id: selectedService,
        funcionario_id: selectedBarber,
        data_hora: appointmentDateTime.toISOString(),
        cliente_nome: safeName,
        cliente_telefone: cleanedPhone, // Salva apenas os dígitos
        cliente_email: safeEmail || null,
        status: 'confirmado' as const, // Auto-confirmado, sistema manual pausado
        // Sempre enviar user_id explicitamente - null para anônimos, user.id para logados
        user_id: isClientLoggedIn && user ? user.id : null,
        // Adicionar customer_id se disponível (usuário não logado com OTP verificado)
        ...(customerId && { customer_id: customerId })
      };

      // 3. Insert into Supabase

      let data, error;

      if (!isClientLoggedIn) {
        // Visitantes podem criar agendamentos, mas não ler a linha criada; por isso o id nasce aqui
        const novoAgendamento = { ...bookingData, id: crypto.randomUUID() };
        const result = await supabase.from('agendamentos').insert(novoAgendamento);
        data = novoAgendamento;
        error = result.error;
      } else {
        // Para usuários logados, usar método normal
        const result = await supabase.from('agendamentos').insert(bookingData).select('*').single();
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error("Erro ao salvar agendamento:", error);
        console.error("Dados enviados:", bookingData);
        if (error.message?.includes('HORARIO_OCUPADO')) {
          await refetchBarbershop();
          throw new Error("Esse horário acabou de ser reservado. Escolha outro.");
        }
        throw new Error("Não foi possível salvar seu agendamento. Verifique os dados e tente novamente.");
      }

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
          setLastCreatedAppointment(fullAppointmentData);
        }
      } else {
        // Para anônimos, construir dados completos manualmente usando dados que já temos
        const fullData = {
          ...data,
          servicos: {
            nome: barbershop.servicos?.find((s: any) => s.id === selectedService)?.nome || '',
            valor: barbershop.servicos?.find((s: any) => s.id === selectedService)?.valor || 0,
            duracao_minutos: barbershop.servicos?.find((s: any) => s.id === selectedService)?.duracao_minutos || 30
          },
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

      // Clear selected time to force time slot regeneration
      setSelectedTime(null);

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
      servico: lastCreatedAppointment.servicos || (() => {
        // Buscar o serviço completo pelo ID selecionado
        const selectedServiceObj = barbershop?.servicos?.find((s: any) => s.id === selectedService);
        return selectedServiceObj ? {
          nome: selectedServiceObj.nome,
          valor: selectedServiceObj.valor,
          duracao_minutos: selectedServiceObj.duracao_minutos
        } : {
          nome: 'Serviço não identificado',
          valor: 0,
          duracao_minutos: 0
        };
      })(),
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
  const isAnonymousUser = !isClientLoggedIn && !clientData.createAccount;

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

  const selectedServiceData: Servico | undefined = barbershop?.servicos.find((s: Servico) => s.id === selectedService);
  const selectedDuration = selectedServiceData?.duracao_minutos ?? 30;

  // Dia, profissional ou serviço mudou: recalcula os horários e descarta o horário escolhido
  useEffect(() => {
    setSelectedTime(null);
    if (selectedDate) {
      generateTimeSlots(selectedDate, selectedBarber, selectedDuration).then(setTimeSlots);
    } else {
      setTimeSlots([]);
    }
  }, [selectedDate, selectedBarber, selectedDuration, generateTimeSlots]);

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
  const shopTheme = shopThemeStyle(barbershop.cores_personalizadas?.primary);
  const endereco = enderecoCompleto(barbershop);
  const selectedBarberName = barbershop.funcionarios.find((b: Funcionario) => b.id === selectedBarber)?.nome;
  const isStaff = !!profile?.role && profile.role !== 'cliente';

  // Texto do resumo fixo no rodapé do agendamento
  const summaryTitle = selectedServiceData?.nome ?? 'Escolha um serviço';
  const summarySubtitle = [
    selectedServiceData && formatBRL(selectedServiceData.valor),
    selectedDate?.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, ''),
    selectedTime,
  ].filter(Boolean).join(' · ');

  const summaryAction = {
    service: { label: 'Continuar', disabled: !selectedService },
    datetime: { label: 'Continuar', disabled: !selectedDate || !selectedTime },
    client: { label: 'Confirmar', disabled: !clientData.name || !clientData.phone },
    otp: { label: 'Continuar', disabled: true },
    confirmation: { label: '', disabled: true },
  }[currentStep];

  const goBack = () => {
    if (currentStep === 'datetime') setCurrentStep('service');
    if (currentStep === 'client') setCurrentStep('datetime');
  };

  const resetBooking = () => {
    setCurrentStep('service');
    setSelectedService(null);
    setSelectedBarber(null);
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
    <div className={`min-h-screen bg-background ${shopTheme ? 'shop-theme' : ''}`} style={shopTheme}>
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

            {currentStep === 'service' && (
              <div className="space-y-4">
                <div className="rounded-3xl border bg-card p-4 sm:p-6">
                  <h2 className="mb-4 text-xl font-bold">Escolha o serviço</h2>
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
                    <ServiceList services={barbershop.servicos} selectedId={selectedService} onSelect={setSelectedService} />
                  )}
                </div>
              </div>
            )}

            {currentStep === 'datetime' && (
              <div className="space-y-4">
                <div className="rounded-3xl border bg-card p-4 sm:p-6">
                  <h2 className="mb-3 text-xl font-bold">Escolha o dia</h2>
                  <DayPicker dates={availableDates} selected={selectedDate} onSelect={setSelectedDate} />
                </div>

                {barbershop.funcionarios.length > 0 && (
                  <div className="rounded-3xl border bg-card p-4 sm:p-6">
                    <h2 className="mb-3 text-xl font-bold">Profissional</h2>
                    <ProfessionalPicker
                      professionals={barbershop.funcionarios}
                      selectedId={selectedBarber}
                      onSelect={setSelectedBarber}
                    />
                  </div>
                )}

                {selectedDate && (
                  <div className="rounded-3xl border bg-card p-4 sm:p-6">
                    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-xl font-bold">Horários</h2>
                      <span className="text-sm text-muted-foreground">
                        {selectedBarberName ? `com ${selectedBarberName}` : 'com qualquer profissional'}
                      </span>
                    </div>
                    <TimeSlotGrid slots={timeSlots} selected={selectedTime} onSelect={setSelectedTime} />
                  </div>
                )}
              </div>
            )}

            {currentStep === 'client' && (
              <div className="space-y-4 rounded-3xl border bg-card p-4 sm:p-6">
                <h2 className="text-xl font-bold">Seus dados</h2>
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
                  { rotulo: 'Serviço', valor: selectedServiceData?.nome },
                  { rotulo: 'Data', valor: selectedDate && formatDate(selectedDate) },
                  { rotulo: 'Horário', valor: selectedTime },
                  { rotulo: 'Profissional', valor: selectedBarberName },
                  { rotulo: 'Valor', valor: selectedServiceData && formatBRL(selectedServiceData.valor) },
                ]}
                canDownload={!!lastCreatedAppointment}
                onDownload={handleDownloadReceipt}
                panelAction={
                  isAnonymousUser
                    ? undefined
                    : {
                        label: isStaff ? 'Voltar para o painel' : 'Ver meus agendamentos',
                        onClick: () => navigate(isStaff ? '/dashboard' : '/meus-agendamentos'),
                      }
                }
                onReset={resetBooking}
              />
            )}

            {(currentStep === 'service' || currentStep === 'datetime' || currentStep === 'client') && barbershop.servicos.length > 0 && (
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
          </section>

          {/* Informações da barbearia */}
          <ShopInfoAside
            nome={barbershop.nome}
            descricao={barbershop.descricao}
            instagramHref={barbershop.instagram ? formatInstagramLink(barbershop.instagram) : undefined}
            facebookHref={barbershop.facebook}
            fotos={galleryImages}
            horarios={barbershop.horarios_funcionamento}
            feedbacks={feedbacks}
          />
        </div>
      </main>
    </div>
  );
};

export default BarberShopDetails;
