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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Star,
  MapPin,
  Clock,
  Phone,
  Mail,
  User,
  Loader2,
  ChevronLeft,
  CheckCircle,
  Sparkles,
  ArrowRight,
  CalendarIcon,
  Download,
  MessageCircle,
  Instagram
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { usePhoneMask } from "@/hooks/usePhoneMask";
import { useResponsive, useResponsiveClasses } from "@/hooks/use-mobile";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { OTPVerification } from "@/components/OTPVerification";
import { toStringSafe, onlyDigits, normalizeToE164 } from "@/lib/utils";
import { anonymousBookingSchema } from "@/hooks/useInputValidation";
import { generatePDFReceipt } from "@/components/PDFGenerator";
import { LazyImage } from "@/components/LazyImage";


type Servico = Database['public']['Tables']['servicos']['Row'];
type Funcionario = Pick<Database['public']['Tables']['funcionarios']['Row'], 'id' | 'nome'>;
type HorarioFuncionamento = Database['public']['Tables']['horarios_funcionamento']['Row'];
type FeedbackWithProfile = Database['public']['Tables']['feedbacks']['Row'] & {
  profiles: {
    name: string | null;
    avatar_url: string | null; // Keep for type consistency, even if not in DB
  } | null;
};
// Type removed - using any for appointment mapping due to complex join structure

// The complex type is causing issues, so we'll let it be inferred for now.
// type BarbershopData = ... (removed)

interface ThemeConfig {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

type BookingStep = 'service' | 'datetime' | 'client' | 'otp' | 'confirmation';

const BarberShopDetails = () => {
  const { slug } = useParams(); // Changed from id to slug
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth(); // Usar o perfil do contexto
  const { isMobile } = useResponsive();
  const responsive = useResponsiveClasses();

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

  // Data state
  const [barbershop, setBarbershop] = useState<any | null>(null); // Set to any to avoid type errors
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>({
    primary: '#8b5cf6',
    secondary: '#6b7280',
    accent: '#f59e0b',
    background: '#111827'
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedbacks, setFeedbacks] = useState<FeedbackWithProfile[]>([]);
  const [timeSlots, setTimeSlots] = useState<{ time: string; isAvailable: boolean }[]>([]);
  const [ausencias, setAusencias] = useState<any[]>([]);

  // Stats calculadas do banco
  const [stats, setStats] = useState({
    totalClientes: 0,
    totalFuncionarios: 0,
    mediaAvaliacoes: 0,
    totalAvaliacoes: 0,
    isOpen: false,
    horarioFormatado: '',
    diasFormatado: ''
  });


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

  // Função para calcular estatísticas da barbearia
  const calculateBarbershopStats = useCallback(async (barbeariaId: string, feedbacksData: any[], horariosData: any[]) => {
    try {
      // 1. Calcular número de clientes únicos (apenas para usuários logados)
      let totalClientes = 0;
      if (user) {
        const { data: clientesData, error: clientesError } = await supabase
          .from('agendamentos')
          .select('user_id')
          .eq('barbearia_id', barbeariaId)
          .not('user_id', 'is', null);

        if (!clientesError && clientesData) {
          const clientesUnicos = new Set(clientesData.map(a => a.user_id));
          totalClientes = clientesUnicos.size;
        }
      }

      // 2. Calcular número de funcionários (agora público para todos)
      let totalFuncionarios = 0;
      if (barbershop && barbershop.funcionarios && barbershop.funcionarios.length > 0) {
        // Se conseguiu carregar funcionários da query principal
        totalFuncionarios = barbershop.funcionarios.length;
      } else {
        // Buscar contagem real de funcionários (agora público)
        const { data: funcionariosData, error: funcionariosError } = await supabase
          .from('funcionarios')
          .select('id')
          .eq('barbearia_id', barbeariaId);

        if (!funcionariosError && funcionariosData) {
          totalFuncionarios = funcionariosData.length;
        } else if (barbershop && barbershop.servicos) {
          // Fallback: usar serviços como aproximação
          totalFuncionarios = Math.max(1, Math.ceil(barbershop.servicos.length / 3));
        }
      }

      // 3. Calcular média das avaliações usando o campo rating (público)
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('feedbacks')
        .select('rating')
        .eq('barbearia_id', barbeariaId)
        .eq('status', 'concluido')
        .not('rating', 'is', null);

      let mediaAvaliacoes = 0;
      let totalAvaliacoes = 0;

      if (!ratingsError && ratingsData && ratingsData.length > 0) {
        totalAvaliacoes = ratingsData.length;
        const total = ratingsData.reduce((sum, item) => sum + (item.rating || 0), 0);
        mediaAvaliacoes = total / totalAvaliacoes;
      }

      // 3. Verificar se está aberto agora
      const now = new Date();
      const diaSemana = now.getDay(); // 0 = Domingo, 1 = Segunda, etc.
      const horaAtual = now.getHours() * 60 + now.getMinutes(); // em minutos

      let isOpen = false;
      let horarioFormatado = '';
      let diasFormatado = '';

      if (horariosData && horariosData.length > 0) {
        const horarioHoje = horariosData.find(h => h.dia_semana === diaSemana);

        if (horarioHoje && !horarioHoje.fechado && horarioHoje.hora_abre && horarioHoje.hora_fecha) {
          const [horaAbre, minAbre] = horarioHoje.hora_abre.split(':').map(Number);
          const [horaFecha, minFecha] = horarioHoje.hora_fecha.split(':').map(Number);
          const abertura = horaAbre * 60 + minAbre;
          const fechamento = horaFecha * 60 + minFecha;

          isOpen = horaAtual >= abertura && horaAtual <= fechamento;
        }

        // Formatar horários de funcionamento
        const horariosAbertos = horariosData.filter(h => !h.fechado && h.hora_abre && h.hora_fecha);
        if (horariosAbertos.length > 0) {
          // Pegar o horário mais comum
          const primeiroHorario = horariosAbertos[0];
          horarioFormatado = `${primeiroHorario.hora_abre.slice(0, 5)} - ${primeiroHorario.hora_fecha.slice(0, 5)}`;

          // Formatar dias
          const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
          const diasAbertos = horariosAbertos.map(h => h.dia_semana).sort();

          if (diasAbertos.length > 0) {
            const primeiro = diasAbertos[0];
            const ultimo = diasAbertos[diasAbertos.length - 1];
            if (diasAbertos.length > 1) {
              diasFormatado = `${diasSemana[primeiro]} - ${diasSemana[ultimo]}`;
            } else {
              diasFormatado = diasSemana[primeiro];
            }
          }
        }
      }

      setStats({
        totalClientes,
        totalFuncionarios,
        mediaAvaliacoes: Math.round(mediaAvaliacoes * 10) / 10, // Arredondar para 1 casa decimal
        totalAvaliacoes,
        isOpen,
        horarioFormatado,
        diasFormatado
      });

    } catch (error) {
      console.error('Erro ao calcular estatísticas:', error);
    }
  }, [user, barbershop]);

  const fetchBarbershopData = useCallback(async () => {
    console.log('[DEBUG] Starting fetchBarbershopData, slug:', slug);

    if (!slug || slug === 'null') {
      console.error("Slug da barbearia não encontrado na URL ou é inválido.");
      setLoading(false);
      return;
    }

    setLoading(true);

    // Timeout de segurança de 15 segundos
    const timeout = setTimeout(() => {
      console.error('[TIMEOUT] Carregamento excedeu 15 segundos');
      setLoading(false);
      toast({
        title: "Erro ao carregar",
        description: "A página demorou muito para carregar. Tente novamente.",
        variant: "destructive"
      });
    }, 15000);

    try {
      console.log('[DEBUG] Step 1: Fetching barbershop data...');
      // Step 1: Fetch main barbershop data
      const { data: barbershopData, error: barbershopError } = await supabase
        .from('barbearias')
        .select(`
          *,
          servicos (*),
          funcionarios (id, nome)
        `)
        .eq('slug', slug) // Changed from id to slug
        .single();

      if (barbershopError) {
        console.error('[ERROR] Erro ao buscar barbearia:', barbershopError);
        clearTimeout(timeout);
        setBarbershop(null);
        setLoading(false);
        return;
      }

      console.log('[DEBUG] Barbershop data loaded successfully:', barbershopData?.nome);


      // Step 2: Fetch working hours
      const { data: horariosData, error: horariosError } = await supabase
        .from('horarios_funcionamento')
        .select('*')
        .eq('barbearia_id', barbershopData.id);

      if (horariosError) {
        console.error('Erro ao buscar horários:', horariosError);
      }

      // Step 2.1: Fetch absences
      const { data: ausenciasData, error: ausenciasError } = await supabase
        .from('funcionario_ausencias')
        .select('*')
        .eq('barbearia_id', barbershopData.id);

      if (ausenciasError) {
        console.error('Erro ao buscar ausências:', ausenciasError);
      } else {
        setAusencias(ausenciasData || []);
      }

      // Step 3: Fetch existing bookings with service duration (confirmed and pending appointments, including anonymous)
      const { data: agendamentosData, error: agendamentosError } = await supabase
        .from('agendamentos')
        .select('data_hora, funcionario_id, user_id, status, servicos!inner ( duracao_minutos )')
        .eq('barbearia_id', barbershopData.id)
        .in('status', ['confirmado', 'pendente']);

      console.log('[DEBUG] Fetched agendamentos:', {
        total: agendamentosData?.length || 0,
        anonymous: agendamentosData?.filter(a => a.user_id === null).length || 0,
        confirmed: agendamentosData?.filter(a => a.status === 'confirmado').length || 0,
        pending: agendamentosData?.filter(a => a.status === 'pendente').length || 0,
        data: agendamentosData
      });

      if (agendamentosError) {
        console.error('Erro ao buscar agendamentos:', agendamentosError);
      }

      // Step 4: Fetch feedbacks (simplified to avoid join issues)
      const { data: feedbacksData, error: feedbacksError } = await supabase
        .from('feedbacks')
        .select('*')
        .eq('barbearia_id', barbershopData.id)
        .eq('status', 'concluido')
        .order('created_at', { ascending: false })
        .limit(10);

      if (feedbacksError) {
        console.error('Erro ao buscar feedbacks:', feedbacksError);
      }

      // Step 5: Combine all data
      const completeData = {
        ...barbershopData,
        horarios_funcionamento: horariosData || [],
        agendamentos: agendamentosData || [],
        funcionarios: barbershopData.funcionarios || [],
      };

      setBarbershop(completeData);
      setFeedbacks((feedbacksData as any) || []);

      // Calcular estatísticas da barbearia
      await calculateBarbershopStats(barbershopData.id, (feedbacksData as any) || [], horariosData || []);

      // Apply custom theme
      if (barbershopData.cores_personalizadas && typeof barbershopData.cores_personalizadas === 'object') {
        const customColors = barbershopData.cores_personalizadas as Record<string, any>;
        if (customColors.primary) {
          setThemeConfig({
            primary: customColors.primary || '#8b5cf6',
            secondary: customColors.secondary || '#6b7280',
            accent: customColors.accent || '#f59e0b',
            background: customColors.background || '#111827'
          });
        }
      }

    } catch (err) {
      console.error('[ERROR] Erro inesperado:', err);
      clearTimeout(timeout);
    } finally {
      clearTimeout(timeout);
      console.log('[DEBUG] Finishing fetchBarbershopData, setting loading to false');
      setLoading(false);
    }
  }, [slug, toast]);

  useEffect(() => {
    fetchBarbershopData();
  }, [fetchBarbershopData]);

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
          const dateStr = date.toISOString().split('T')[0];
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

  // Generate available time slots for selected date and employee
  const generateTimeSlots = useCallback(async (date: Date, funcionarioId: string | null = null) => {
    if (!barbershop || !date) return [];

    const dayOfWeek = date.getDay();
    const workingHours = barbershop.horarios_funcionamento.find((h: HorarioFuncionamento) => h.dia_semana === dayOfWeek);

    if (!workingHours || workingHours.fechado || !workingHours.hora_abre || !workingHours.hora_fecha) {
      return [];
    }

    // Check if funcionario is on vacation/leave on this date
    if (funcionarioId) {
      const { data: ausencias } = await supabase
        .from('funcionario_ausencias')
        .select('*')
        .eq('funcionario_id', funcionarioId)
        .lte('data_inicio', date.toISOString().split('T')[0])
        .gte('data_fim', date.toISOString().split('T')[0]);

      // If funcionario is absent, return empty slots
      if (ausencias && ausencias.length > 0) {
        console.log(`[DEBUG] Funcionário ${funcionarioId} está ausente em ${date.toDateString()}`);
        return [];
      }
    }

    const slots = [];
    const defaultInterval = 30; // Default 30 minute slots for free time

    // Debug: Log appointments for this barbershop
    console.log(`[DEBUG] Generating time slots for ${date.toDateString()}`);
    console.log(`[DEBUG] Selected funcionario_id:`, funcionarioId);
    console.log(`[DEBUG] Total appointments in barbershop:`, barbershop.agendamentos?.length || 0);

    const [startHour, startMinute] = workingHours.hora_abre.split(':').map(Number);
    const [endHour, endMinute] = workingHours.hora_fecha.split(':').map(Number);

    const openTime = new Date(date);
    openTime.setHours(startHour, startMinute, 0, 0);

    const closeTime = new Date(date);
    closeTime.setHours(endHour, endMinute, 0, 0);

    // FILTRAR agendamentos por funcionário antes de processar
    const filteredAppointments = barbershop.agendamentos.filter((a: any) => {
      // Se um funcionário específico foi selecionado, filtrar apenas seus agendamentos
      if (funcionarioId) {
        return a.funcionario_id === funcionarioId;
      }
      // Se nenhum funcionário foi selecionado (qualquer profissional),
      // incluir agendamentos SEM funcionário (null) e com qualquer funcionário
      // Isso garante que agendamentos anônimos bloqueiem horários
      return true;
    });

    console.log(`[DEBUG] Filtered appointments for funcionario:`, filteredAppointments.length);

    const dailyAppointments = filteredAppointments
      .map((a: any) => {
        const startTime = new Date(a.data_hora);
        // servicos vem como objeto direto do inner join, não como array
        const duration = a.servicos?.duracao_minutos || defaultInterval;
        const endTime = new Date(startTime.getTime() + duration * 60000);

        console.log(`[DEBUG] Mapping appointment:`, {
          data_hora: a.data_hora,
          funcionario_id: a.funcionario_id,
          user_id: a.user_id,
          duration: duration,
          start: startTime.toISOString(),
          end: endTime.toISOString()
        });

        return { start: startTime, end: endTime };
      })
      .filter((a: { start: Date; end: Date }) => {
        // More robust date comparison - compare year, month, and day separately
        const appointmentDate = a.start;
        const matches = appointmentDate.getFullYear() === date.getFullYear() &&
          appointmentDate.getMonth() === date.getMonth() &&
          appointmentDate.getDate() === date.getDate();
        return matches;
      })
      .sort((a: { start: Date; end: Date }, b: { start: Date; end: Date }) => a.start.getTime() - b.start.getTime());

    // Debug: Log filtered appointments for this day
    console.log(`[DEBUG] Appointments for ${date.toDateString()}:`, dailyAppointments.length);
    dailyAppointments.forEach((appt: any, index: number) => {
      console.log(`[DEBUG] Appointment ${index + 1}: ${appt.start.toISOString()} - ${appt.end.toISOString()}`);
    });

    let lastEndTime = new Date(openTime);

    dailyAppointments.forEach((appointment: { start: Date; end: Date }) => {
      // Generate slots between the last appointment's end and this one's start
      while (lastEndTime.getTime() < appointment.start.getTime()) {
        if (lastEndTime >= new Date()) {
          slots.push({
            time: lastEndTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            isAvailable: true,
          });
        }
        lastEndTime.setMinutes(lastEndTime.getMinutes() + defaultInterval);
      }

      // Update the last end time to the end of the current appointment
      lastEndTime = new Date(Math.max(lastEndTime.getTime(), appointment.end.getTime()));
    });

    // Generate slots after the last appointment until closing time
    while (lastEndTime.getTime() < closeTime.getTime()) {
      if (lastEndTime >= new Date()) {
        slots.push({
          time: lastEndTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          isAvailable: true,
        });
      }
      lastEndTime.setMinutes(lastEndTime.getMinutes() + defaultInterval);
    }

    console.log(`[DEBUG] Generated ${slots.length} available time slots for ${funcionarioId || 'any employee'}`);
    return slots;
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
        // Para usuários anônimos, usar Edge Function que tem privilégios administrativos
        const { data: functionData, error: functionError } = await supabase.functions.invoke('create-anonymous-booking', {
          body: bookingData
        });

        if (functionError) {
          error = functionError;
        } else if (functionData?.success) {
          data = functionData.data;
        } else {
          error = new Error(functionData?.error || 'Failed to create booking');
        }
      } else {
        // Para usuários logados, usar método normal
        const result = await supabase.from('agendamentos').insert(bookingData).select('*').single();
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error("Erro ao salvar agendamento:", error);
        console.error("Dados enviados:", bookingData);
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
          .eq('id', data.id)
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
      await fetchBarbershopData();

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
  const formatWhatsAppLink = (phone: string, barbershopName: string) => {
    // Remove all non-numeric characters
    const cleanPhone = phone.replace(/\D/g, '');
    // Add country code if not present (assuming Brazil +55)
    const fullPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const message = encodeURIComponent(`Olá! Vi o perfil da ${barbershopName} e gostaria de agendar um horário.`);
    return `https://wa.me/${fullPhone}?text=${message}`;
  };

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

  useEffect(() => {
    if (selectedDate) {
      generateTimeSlots(selectedDate, selectedBarber).then(setTimeSlots);
    } else {
      setTimeSlots([]);
    }
  }, [selectedDate, selectedBarber, generateTimeSlots]);

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

  if (!barbershop) {
    return (
      <div className="min-h-screen bg-gradient-bg flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Barbearia não encontrada</h2>
          <Button onClick={() => navigate('/barbearias')}>
            Voltar para listagem
          </Button>
        </div>
      </div>
    );
  }

  const availableDates = generateAvailableDates(selectedBarber);
  const galleryImages = barbershop.gallery_urls || [];

  return (
    <div className="min-h-screen bg-gradient-bg">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/barbearias')}
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-4">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={barbershop.logo_url || '/placeholder.svg'} />
                  <AvatarFallback>{barbershop.nome?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-xl font-bold">{barbershop.nome}</h1>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    {barbershop.cidade}
                  </div>
                </div>
              </div>
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Hero Section Renovado */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/10 to-primary/30"></div>
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, ${themeConfig.primary}15 0%, transparent 50%), 
                           radial-gradient(circle at 75% 75%, ${themeConfig.accent}15 0%, transparent 50%)`,
        }}></div>

        {/* Hero Content */}
        <div className={`relative max-w-7xl mx-auto ${responsive.containerPadding} ${isMobile ? 'py-6' : 'py-8 lg:py-16'}`}>
          <div className={`grid ${isMobile ? 'grid-cols-1 gap-6' : 'lg:grid-cols-2 gap-8 lg:gap-12'} items-center`}>
            {/* Left Side - Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-4 lg:space-y-6"
            >
              <div className={`flex items-center ${isMobile ? 'gap-3' : 'gap-3 lg:gap-4'}`}>
                <div className="relative">
                  {barbershop.logo_url ? (
                    <LazyImage
                      src={barbershop.logo_url}
                      alt={barbershop.nome}
                      className={`${isMobile ? 'w-14 h-14' : 'w-16 h-16 lg:w-20 lg:h-20'} rounded-2xl shadow-2xl border-4 border-background`}
                    />
                  ) : (
                    <div
                      className={`${isMobile ? 'w-14 h-14' : 'w-16 h-16 lg:w-20 lg:h-20'} rounded-2xl flex items-center justify-center text-white font-bold ${isMobile ? 'text-lg' : 'text-xl lg:text-2xl'} shadow-2xl border-4 border-background`}
                      style={{ backgroundColor: themeConfig.primary }}
                    >
                      {barbershop.nome?.charAt(0) || "B"}
                    </div>
                  )}
                  <div className={`absolute -bottom-1 -right-1 lg:-bottom-2 lg:-right-2 ${isMobile ? 'w-4 h-4' : 'w-5 h-5 lg:w-6 lg:h-6'} bg-green-500 rounded-full border-2 border-background flex items-center justify-center`}>
                    <div className={`${isMobile ? 'w-1 h-1' : 'w-1.5 h-1.5 lg:w-2 lg:h-2'} bg-white rounded-full`}></div>
                  </div>
                </div>

                <div className="flex-1">
                  <h1 className={`${responsive.heading.h1} font-bold ${isMobile ? 'mb-1' : 'mb-1 lg:mb-2'}`}>{barbershop.nome}</h1>
                  <div className={`flex ${isMobile ? 'flex-col gap-2' : 'flex-col sm:flex-row sm:items-center gap-2 sm:gap-4'} text-muted-foreground`}>
                    <div className="flex items-center gap-1">
                      <Star className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4 lg:w-5 lg:h-5'} fill-yellow-400 text-yellow-400`} />
                      <span className={`font-semibold ${isMobile ? 'text-sm' : 'text-sm lg:text-base'}`}>
                        {stats.totalAvaliacoes > 0 ? stats.mediaAvaliacoes.toFixed(1) : "N/A"}
                      </span>
                      <span className={`${isMobile ? 'text-xs' : 'text-xs lg:text-sm'}`}>
                        ({stats.totalAvaliacoes} {stats.totalAvaliacoes === 1 ? 'avaliação' : 'avaliações'})
                      </span>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`${isMobile ? 'text-xs' : 'text-xs lg:text-sm'} w-fit ${stats.isOpen
                        ? 'bg-green-500/10 text-green-600 border-green-500/20'
                        : 'bg-red-500/10 text-red-600 border-red-500/20'
                        }`}
                    >
                      {stats.isOpen ? 'Aberto agora' : 'Fechado agora'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Stats Cards - Hidden on very small screens */}
              <div className={`${isMobile ? 'hidden' : 'hidden sm:grid'} grid-cols-2 ${isMobile ? 'gap-2' : 'gap-3 lg:gap-4'}`}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  className="bg-card/60 backdrop-blur-sm rounded-xl p-3 lg:p-4 border border-border/50"
                >
                  <div className="text-center">
                    <div className="text-lg lg:text-2xl font-bold" style={{ color: themeConfig.primary }}>
                      {stats.totalClientes > 0 ? `${stats.totalClientes}${stats.totalClientes >= 1000 ? '+' : ''}` : '0'}
                    </div>
                    <div className="text-xs lg:text-sm text-muted-foreground">Clientes</div>
                  </div>
                </motion.div>


                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="bg-card/60 backdrop-blur-sm rounded-xl p-3 lg:p-4 border border-border/50"
                >
                  <div className="text-center">
                    <div className="text-lg lg:text-2xl font-bold" style={{ color: themeConfig.primary }}>
                      {stats.totalFuncionarios}
                    </div>
                    <div className="text-xs lg:text-sm text-muted-foreground">Profissionais</div>
                  </div>
                </motion.div>
              </div>

              {/* Quick Info - Simplified for mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
                <div className="flex items-center gap-3 bg-card/40 backdrop-blur-sm rounded-lg p-3 border border-border/30">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 lg:w-5 lg:h-5" style={{ color: themeConfig.primary }} />
                  </div>
                  <div>
                    <div className="font-medium text-sm lg:text-base">
                      {stats.horarioFormatado || "Não informado"}
                    </div>
                    <div className="text-xs lg:text-sm text-muted-foreground">
                      {stats.diasFormatado || "Consultar horários"}
                    </div>
                  </div>
                </div>

                <div
                  className="flex items-center gap-3 bg-card/40 backdrop-blur-sm rounded-lg p-3 border border-border/30 lg:hidden cursor-pointer hover:bg-card/60 transition-colors"
                  onClick={() => {
                    const whatsappUrl = formatWhatsAppLink(barbershop.telefone, barbershop.nome);
                    window.open(whatsappUrl, '_blank');
                  }}
                >
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-green-500"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.097" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{barbershop.telefone}</div>
                    <div className="text-xs text-muted-foreground">Chamar no WhatsApp</div>
                  </div>
                </div>

                <div className="hidden lg:flex items-center gap-3 bg-card/40 backdrop-blur-sm rounded-lg p-3 border border-border/30">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-5 h-5" style={{ color: themeConfig.primary }} />
                  </div>
                  <div>
                    <div className="font-medium">{barbershop.cidade}</div>
                    <div className="text-sm text-muted-foreground">15 min do centro</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Side - Gallery Preview */}
            {galleryImages.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="hidden lg:block"
              >
                <div className="grid grid-cols-2 gap-4">
                  {galleryImages.slice(0, 4).map((url: string, index: number) => (
                    <div key={index} className="aspect-square bg-card/60 backdrop-blur-sm rounded-2xl border border-border/50 overflow-hidden group">
                      <LazyImage
                        src={url}
                        alt={`Galeria ${index + 1}`}
                        className="w-full h-full transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Description Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 lg:pb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="bg-card/60 backdrop-blur-sm rounded-xl p-4 lg:p-8 border border-border/50"
          >
            <h3 className="text-xl font-semibold mb-4">Sobre a Barbearia</h3>
            <p className="text-muted-foreground leading-relaxed">
              {barbershop.descricao || "Uma barbearia moderna e acolhedora, pronta para oferecer o melhor serviço da região."}
            </p>

            {/* Social Media Links */}
            {(barbershop.instagram || barbershop.facebook) && (
              <div className="flex gap-4 mt-6 pt-6 border-t border-border/50">
                {barbershop.instagram && (
                  <a
                    href={formatInstagramLink(barbershop.instagram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Instagram className="w-5 h-5" />
                    <span className="text-sm">Instagram</span>
                  </a>
                )}
                {barbershop.facebook && (
                  <a
                    href={barbershop.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-sm">Facebook</span>
                  </a>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Feedbacks (Hidden on mobile, shown below on desktop) */}
          <div className="hidden lg:block space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm h-fit sticky top-24">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    Avaliações Recentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {feedbacks.length > 0 ? (
                      feedbacks.map((feedback, index) => (
                        <div key={feedback.id} className="flex gap-3 p-3 rounded-lg bg-muted/30">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={feedback.profiles?.avatar_url || undefined} />
                            <AvatarFallback>
                              {feedback.profiles?.name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex-items-center justify-between">
                              <h5 className="font-semibold">{feedback.anonimo ? 'Anônimo' : (feedback.profiles?.name || 'Usuário')}</h5>
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-4 h-4 ${i < (feedback.rating || 0)
                                      ? 'text-yellow-400 fill-yellow-400'
                                      : 'text-muted-foreground'
                                      }`}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{feedback.comment}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Ainda não há avaliações.
                      </p>
                    )}

                    {/* Informação sobre como avaliar */}
                    <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs text-muted-foreground text-center">
                        ðŸ’¡ As avaliações aparecem após o serviço ser finalizado.
                        {user ? ' Você pode avaliar no seu painel após usar um serviço.' : ' Faça login e agende um serviço para poder avaliar.'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Booking Flow (Full width on mobile) */}
          <div className="col-span-1 lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <CalendarIcon className="w-4 h-4" style={{ color: themeConfig.primary }} />
                      </div>
                      {currentStep === 'service' && 'Escolha o Serviço'}
                      {currentStep === 'datetime' && 'Selecione Data e Horário'}
                      {currentStep === 'client' && 'Suas Informações'}
                      {/* currentStep === 'otp' && 'Verificação de Telefone' - TEMPORARIAMENTE DESABILITADO */}
                      {currentStep === 'confirmation' && 'Agendamento Confirmado!'}
                    </CardTitle>

                    {/* Progress Steps */}
                    <div className="flex items-center gap-2">
                      {['service', 'datetime', 'client', 'otp', 'confirmation'].map((step, index) => (
                        <div
                          key={step}
                          className={`w-2 h-2 rounded-full transition-all ${currentStep === step
                            ? 'w-8'
                            : ['service', 'datetime', 'client', 'confirmation'].indexOf(currentStep) > index
                              ? 'bg-primary/60'
                              : 'bg-muted'
                            }`}
                          style={{
                            backgroundColor: currentStep === step ? themeConfig.primary : undefined
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <AnimatePresence mode="wait">
                    {/* Step 1: Service Selection */}
                    {currentStep === 'service' && (
                      <motion.div
                        key="service"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4"
                      >
                        <div className="grid gap-3 lg:gap-4">
                          {barbershop.servicos.map((service: Servico, index: number) => (
                            <motion.div
                              key={service.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: index * 0.1 }}
                              className={`group relative p-4 lg:p-6 border rounded-xl lg:rounded-2xl cursor-pointer transition-all hover:shadow-lg ${selectedService === service.id
                                ? 'border-primary shadow-lg'
                                : 'border-border/50 hover:border-border'
                                }`}
                              style={{
                                borderColor: selectedService === service.id ? themeConfig.primary : undefined,
                                backgroundColor: selectedService === service.id ? `${themeConfig.primary}08` : undefined
                              }}
                              onClick={() => setSelectedService(service.id)}
                            >
                              <div className="flex justify-between items-start">
                                <div className="space-y-1 lg:space-y-2 flex-1">
                                  <h4 className="font-semibold text-base lg:text-lg">{service.nome}</h4>
                                  <p className="text-xs lg:text-sm text-muted-foreground">
                                    Duração: {service.duracao_minutos} minutos
                                  </p>
                                  <p className="text-xs lg:text-sm text-muted-foreground pt-1">
                                    {service.descricao}
                                  </p>
                                </div>
                                <div className="text-right ml-4">
                                  <div className="text-lg lg:text-2xl font-bold" style={{ color: themeConfig.primary }}>
                                    R$ {service.valor}
                                  </div>
                                  {selectedService === service.id && (
                                    <motion.div
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                      className="mt-1 lg:mt-2"
                                    >
                                      <CheckCircle className="w-5 h-5 lg:w-6 lg:h-6 text-green-500" />
                                    </motion.div>
                                  )}
                                </div>
                              </div>

                              {/* Selection indicator */}
                              {selectedService === service.id && (
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: '100%' }}
                                  className="absolute bottom-0 left-0 h-1 rounded-full"
                                  style={{ backgroundColor: themeConfig.primary }}
                                />
                              )}
                            </motion.div>
                          ))}
                        </div>

                        {/* Team Selection */}
                        {barbershop.funcionarios.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.2 }}
                            className="mt-8"
                          >
                            <h4 className={`font-semibold ${isMobile ? 'mb-3 text-sm' : 'mb-3 lg:mb-4'} flex items-center gap-2`}>
                              <User className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'}`} />
                              Escolha o Profissional (Opcional)
                            </h4>
                            <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4'}`}>
                              {barbershop.funcionarios.map((barber: Funcionario, index: number) => (
                                <motion.div
                                  key={barber.id}
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                                  className={`${isMobile ? 'p-3' : 'p-3 lg:p-4'} border ${isMobile ? 'rounded-lg' : 'rounded-lg lg:rounded-xl'} cursor-pointer transition-all hover:shadow-md touch-target ${selectedBarber === barber.id
                                    ? 'border-primary shadow-md'
                                    : 'border-border/50 hover:border-border'
                                    }`}
                                  style={{
                                    borderColor: selectedBarber === barber.id ? themeConfig.primary : undefined,
                                    backgroundColor: selectedBarber === barber.id ? `${themeConfig.primary}05` : undefined
                                  }}
                                  onClick={() => setSelectedBarber(selectedBarber === barber.id ? null : barber.id)}
                                >
                                  <div className="flex items-center gap-3">
                                    <Avatar className={`${isMobile ? 'w-10 h-10' : 'w-10 h-10 lg:w-12 lg:h-12'}`}>
                                      <AvatarImage src={'/placeholder.svg'} />
                                      <AvatarFallback>{barber.nome?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                      <h5 className={`font-medium ${isMobile ? 'text-sm' : 'text-sm lg:text-base'}`}>{barber.nome}</h5>
                                      <div className={`flex items-center gap-1 ${isMobile ? 'text-xs' : 'text-xs lg:text-sm'} text-muted-foreground`}>
                                        <Star className={`${isMobile ? 'w-3 h-3' : 'w-3 h-3'} fill-yellow-400 text-yellow-400`} />
                                        4.9
                                      </div>
                                    </div>
                                    {selectedBarber === barber.id && (
                                      <CheckCircle className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4 lg:w-5 lg:h-5'} text-green-500`} />
                                    )}
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </motion.div>
                        )}

                        <div className={`${isMobile ? 'pt-4' : 'pt-4 lg:pt-6'}`}>
                          <Button
                            onClick={handleNextStep}
                            disabled={!selectedService}
                            className={`w-full ${responsive.button.size} ${responsive.button.text} font-semibold touch-target`}
                            style={{ backgroundColor: selectedService ? themeConfig.primary : undefined }}
                          >
                            {selectedService ? 'Continuar' : 'Selecione um serviço'}
                            <ArrowRight className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4 lg:w-5 lg:h-5'} ml-2`} />
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 2: Date & Time Selection */}
                    {currentStep === 'datetime' && (
                      <motion.div
                        key="datetime"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-8"
                      >
                        {/* Date Selection */}
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.1 }}
                        >
                          <h4 className={`font-semibold ${isMobile ? 'mb-3 text-sm' : 'mb-4'} flex items-center gap-2`}>
                            <CalendarIcon className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                            Escolha o Dia
                          </h4>
                          <div className={`grid ${isMobile ? 'grid-cols-2 gap-2' : 'grid-cols-2 md:grid-cols-3 gap-3'}`}>
                            {availableDates.slice(0, 12).map((date, index) => (
                              <motion.div
                                key={date.toISOString()}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.2, delay: index * 0.05 }}
                              >
                                <Button
                                  variant={selectedDate?.toDateString() === date.toDateString() ? "default" : "outline"}
                                  className={`h-auto p-4 text-left w-full transition-all hover:shadow-md ${selectedDate?.toDateString() === date.toDateString()
                                    ? 'shadow-lg'
                                    : ''
                                    }`}
                                  style={{
                                    backgroundColor: selectedDate?.toDateString() === date.toDateString()
                                      ? themeConfig.primary
                                      : undefined,
                                    borderColor: selectedDate?.toDateString() === date.toDateString()
                                      ? themeConfig.primary
                                      : `${themeConfig.primary}30`
                                  }}
                                  onClick={() => setSelectedDate(date)}
                                >
                                  <div className="space-y-1">
                                    <div className="font-semibold">
                                      {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                    </div>
                                    <div className="text-xs opacity-75 capitalize">
                                      {date.toLocaleDateString('pt-BR', { weekday: 'short' })}
                                    </div>
                                  </div>
                                  {selectedDate?.toDateString() === date.toDateString() && (
                                    <CheckCircle className="w-4 h-4 mt-2 text-white" />
                                  )}
                                </Button>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>

                        {/* Time Selection */}
                        {selectedDate && (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.2 }}
                          >
                            <h4 className="font-semibold mb-4 flex items-center gap-2">
                              <Clock className="w-5 h-5" />
                              Escolha o Horário
                            </h4>
                            <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                              {timeSlots.map(({ time, isAvailable }, index) => (
                                <motion.div
                                  key={time}
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ duration: 0.2, delay: index * 0.03 }}
                                >
                                  <Button
                                    variant={selectedTime === time ? "default" : "outline"}
                                    size="sm"
                                    disabled={!isAvailable}
                                    className={`w-full transition-all hover:shadow-md ${selectedTime === time ? 'shadow-lg' : ''
                                      } ${!isAvailable ? 'opacity-40' : ''}`}
                                    style={{
                                      backgroundColor: selectedTime === time ? themeConfig.primary : undefined,
                                      borderColor: selectedTime === time
                                        ? themeConfig.primary
                                        : isAvailable
                                          ? `${themeConfig.primary}30`
                                          : undefined
                                    }}
                                    onClick={() => isAvailable && setSelectedTime(time)}
                                  >
                                    {time}
                                    {selectedTime === time && (
                                      <CheckCircle className="w-3 h-3 ml-1 text-white" />
                                    )}
                                  </Button>
                                </motion.div>
                              ))}
                            </div>
                          </motion.div>
                        )}

                        <div className="flex gap-3 lg:gap-4 pt-4">
                          <Button
                            variant="outline"
                            onClick={() => setCurrentStep('service')}
                            className="flex-1 h-11 lg:h-12"
                            style={{ borderColor: themeConfig.primary, color: themeConfig.primary }}
                          >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            <span className="hidden sm:inline">Voltar</span>
                            <span className="sm:hidden">Voltar</span>
                          </Button>
                          <Button
                            className="flex-1 h-11 lg:h-12 text-white text-sm lg:text-base"
                            disabled={!selectedDate || !selectedTime}
                            onClick={handleNextStep}
                            style={{ backgroundColor: (selectedDate && selectedTime) ? themeConfig.primary : undefined }}
                          >
                            <span className="hidden sm:inline">
                              {selectedDate && selectedTime ? 'Continuar' : 'Selecione data e horário'}
                            </span>
                            <span className="sm:hidden">
                              {selectedDate && selectedTime ? 'Continuar' : 'Selecione'}
                            </span>
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 3: Client Information */}
                    {currentStep === 'client' && (
                      <motion.div
                        key="client"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-8"
                      >
                        {/* Client Form */}
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.1 }}
                          className="space-y-6"
                        >
                          <h4 className="font-semibold mb-4 flex items-center gap-2">
                            <User className="w-5 h-5" />
                            Suas Informações
                          </h4>

                          <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <Label htmlFor="name" className="text-sm font-medium">Nome Completo *</Label>
                              <div className="relative">
                                <Input
                                  id="name"
                                  value={clientData.name}
                                  onChange={(e) => setClientData(prev => ({ ...prev, name: e.target.value }))}
                                  placeholder="Seu nome completo"
                                  pattern="[a-zA-ZÀ-ÿ\s'.-]{2,}"
                                  title="Digite seu nome completo (apenas letras, espaços, acentos, apostrofes e hífens)"
                                  className="pl-10 h-11"
                                  style={{ borderColor: clientData.name ? `${themeConfig.primary}50` : undefined }}
                                  disabled={isClientLoggedIn}
                                />
                                <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="phone" className="text-sm font-medium">Telefone *</Label>
                              <div className="relative">
                                <Input
                                  id="phone"
                                  value={toStringSafe(phoneValue)}
                                  onChange={(e) => {
                                    handleChange(e);
                                    const inputValue = toStringSafe(e.target.value);
                                    // Usar função segura para extrair apenas dígitos
                                    const cleanPhoneValue = onlyDigits(inputValue);
                                    setClientData(prev => ({ ...prev, phone: cleanPhoneValue }));
                                  }}
                                  onBlur={handleBlur}
                                  placeholder="(XX) XXXXX-XXXX"
                                  maxLength={15}
                                  className="pl-10 h-11"
                                  style={{ borderColor: clientData.phone ? `${themeConfig.primary}50` : undefined }}
                                  disabled={isClientLoggedIn}
                                />
                                <Phone className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium">
                              E-mail {clientData.createAccount ? '(Obrigatório)' : '(Opcional)'}
                            </Label>
                            <div className="relative">
                              <Input
                                id="email"
                                type="email"
                                value={toStringSafe(clientData.email)}
                                onChange={(e) => setClientData(prev => ({ ...prev, email: toStringSafe(e.target.value) }))}
                                placeholder="seu@email.com"
                                className="pl-10 h-11"
                                style={{
                                  borderColor: clientData.createAccount
                                    ? (clientData.email ? `${themeConfig.primary}50` : '#ef4444')
                                    : (clientData.email ? `${themeConfig.primary}50` : undefined)
                                }}
                                required={clientData.createAccount}
                              />
                              <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>

                          {!isClientLoggedIn && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.3, delay: 0.2 }}
                              className="flex items-start space-x-3 p-4 bg-card/30 rounded-lg border border-border/50"
                            >
                              <Checkbox
                                id="createAccount"
                                checked={clientData.createAccount}
                                onCheckedChange={(checked) =>
                                  setClientData(prev => ({ ...prev, createAccount: checked as boolean }))
                                }
                                style={{
                                  borderColor: themeConfig.primary,
                                  backgroundColor: clientData.createAccount ? themeConfig.primary : undefined
                                }}
                                disabled={isClientLoggedIn}
                              />
                              <div className="space-y-1">
                                <Label htmlFor="createAccount" className="text-sm font-medium leading-none">
                                  Criar conta para facilitar próximos agendamentos
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  Receba notificações e tenha acesso ao seu histórico
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </motion.div>

                        {/* Summary */}
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.3 }}
                          className="bg-gradient-to-r from-card/60 to-card/40 backdrop-blur-sm p-6 rounded-2xl border border-border/50"
                        >
                          <h4 className="font-semibold mb-4 flex items-center gap-2">
                            <CheckCircle className="w-5 h-5" style={{ color: themeConfig.primary }} />
                            Resumo do Agendamento
                          </h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center py-2 border-b border-border/30">
                              <span className="text-muted-foreground">Serviço:</span>
                              <span className="font-medium">{barbershop.servicos.find((s: Servico) => s.id === selectedService)?.nome}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-border/30">
                              <span className="text-muted-foreground">Data:</span>
                              <span className="font-medium">{selectedDate && formatDate(selectedDate)}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-border/30">
                              <span className="text-muted-foreground">Horário:</span>
                              <span className="font-medium">{selectedTime}</span>
                            </div>
                            {selectedBarber && (
                              <div className="flex justify-between items-center py-2 border-b border-border/30">
                                <span className="text-muted-foreground">Profissional:</span>
                                <span className="font-medium">{barbershop.funcionarios.find((b: Funcionario) => b.id === selectedBarber)?.nome}</span>
                              </div>
                            )}
                            <div className="flex justify-between items-center py-3 border-t-2 border-primary/20">
                              <span className="text-lg font-semibold">Total:</span>
                              <span className="text-2xl font-bold" style={{ color: themeConfig.primary }}>
                                R$ {barbershop.servicos.find((s: Servico) => s.id === selectedService)?.valor}
                              </span>
                            </div>
                          </div>
                        </motion.div>

                        <div className="flex gap-3">
                          <Button
                            variant="outline"
                            onClick={() => setCurrentStep('datetime')}
                            className="flex-1"
                          >
                            <ChevronLeft className="w-4 h-4 mr-2" />
                            Voltar
                          </Button>
                          <Button
                            className="flex-1 text-white"
                            disabled={!clientData.name || !clientData.phone || submitting}
                            onClick={handleNextStep}
                            style={{ backgroundColor: themeConfig.primary }}
                          >
                            {submitting ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Confirmando...
                              </>
                            ) : (
                              'Confirmar Agendamento'
                            )}
                          </Button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 4: OTP Verification - TEMPORARIAMENTE DESABILITADO */}
                    {/* TODO: Reativar quando API de SMS estiver disponível */}
                    {isOTPEnabled && currentStep === 'otp' && (
                      <motion.div
                        key="otp"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-6"
                      >
                        <OTPVerification
                          phone={clientData.phone}
                          name={clientData.name}
                          onVerified={handleOTPVerified}
                          onBack={handleOTPBack}
                        />
                      </motion.div>
                    )}

                    {/* Step 5: Confirmation */}
                    {currentStep === 'confirmation' && (
                      <motion.div
                        key="confirmation"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="text-center py-8"
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                          className="mb-6"
                        >
                          <div
                            className={`${isMobile ? 'w-16 h-16' : 'w-20 h-20'} rounded-full mx-auto flex items-center justify-center mb-4`}
                            style={{ backgroundColor: themeConfig.primary + '20' }}
                          >
                            <CheckCircle
                              className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'}`}
                              style={{ color: themeConfig.primary }}
                            />
                          </div>
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                          >
                            <h3 className={`${responsive.heading.h2} font-bold mb-2`} style={{ color: themeConfig.primary }}>
                              Agendamento Confirmado!
                            </h3>
                            <p className={`text-muted-foreground ${isMobile ? 'mb-4 text-sm' : 'mb-6'}`}>
                              Seu horário foi reservado com sucesso. Você receberá uma confirmação em breve.
                            </p>
                          </motion.div>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6 }}
                          className={`bg-muted/30 ${isMobile ? 'p-3' : 'p-4'} rounded-lg ${isMobile ? 'mb-4' : 'mb-6'}`}
                        >
                          <h4 className={`font-medium ${isMobile ? 'mb-2 text-sm' : 'mb-2'}`}>Detalhes do Agendamento</h4>
                          <div className={`space-y-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                            <div className="flex justify-between">
                              <span>Cliente:</span>
                              <span>{clientData.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Telefone:</span>
                              <span>{clientData.phone}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Serviço:</span>
                              <span>{barbershop.servicos.find((s: Servico) => s.id === selectedService)?.nome}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Data:</span>
                              <span>{selectedDate && formatDate(selectedDate)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Horário:</span>
                              <span>{selectedTime}</span>
                            </div>
                          </div>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.8 }}
                          className={`${isMobile ? 'space-y-2' : 'space-y-3'}`}
                        >
                          {/* Botão condicional - só aparece para usuários logados ou que criaram conta */}
                          {!isAnonymousUser && (
                            <Button
                              className={`w-full text-white ${responsive.button.size} touch-target`}
                              onClick={() => navigate('/dashboard')}
                              style={{ backgroundColor: themeConfig.primary }}
                            >
                              <Sparkles className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'} mr-2`} />
                              Voltar para o Painel
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            className={`w-full ${responsive.button.size} touch-target`}
                            onClick={() => {
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
                            }}
                          >
                            Fazer Novo Agendamento
                          </Button>

                          {/* Botão de baixar comprovante */}
                          <Button
                            variant="default"
                            className={`w-full ${responsive.button.size} touch-target`}
                            onClick={handleDownloadReceipt}
                            disabled={!lastCreatedAppointment}
                            style={{
                              backgroundColor: themeConfig.accent || themeConfig.primary,
                              color: 'white',
                              opacity: !lastCreatedAppointment ? 0.6 : 1
                            }}
                          >
                            <Download className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'} mr-2`} />
                            Baixar Comprovante
                          </Button>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div >
  );
};

export default BarberShopDetails;
