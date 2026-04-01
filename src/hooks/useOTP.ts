import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OTPState {
  isLoading: boolean;
  isVerifying: boolean;
  otpSent: boolean;
  verified: boolean;
  customerId: string | null;
  error: string | null;
}

interface UseOTPReturn extends OTPState {
  sendOTP: (phone: string, name: string) => Promise<boolean>;
  verifyOTP: (phone: string, name: string, otp: string) => Promise<boolean>;
  reset: () => void;
}

// Função para normalizar telefone para E.164
const normalizePhoneToE164 = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  
  // Se já tem código do país (+55), mantém
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    return `+${cleaned}`;
  }
  
  // Se tem 11 dígitos (celular brasileiro), adiciona +55
  if (cleaned.length === 11 && cleaned.startsWith('9')) {
    return `+55${cleaned}`;
  }
  
  // Se tem 10 dígitos (telefone fixo brasileiro), adiciona +55
  if (cleaned.length === 10) {
    return `+55${cleaned}`;
  }
  
  // Se tem 9 dígitos (celular sem DDD), assume DDD 11 (São Paulo)
  if (cleaned.length === 9 && cleaned.startsWith('9')) {
    return `+5511${cleaned}`;
  }
  
  // Se tem 8 dígitos (fixo sem DDD), assume DDD 11 (São Paulo)
  if (cleaned.length === 8) {
    return `+5511${cleaned}`;
  }
  
  throw new Error('Formato de telefone inválido');
};

export const useOTP = (): UseOTPReturn => {
  const { toast } = useToast();
  const [state, setState] = useState<OTPState>({
    isLoading: false,
    isVerifying: false,
    otpSent: false,
    verified: false,
    customerId: null,
    error: null,
  });

  const sendOTP = async (phone: string, name: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const phoneE164 = normalizePhoneToE164(phone);
      
      // Simular envio de OTP (em produção, usar serviço real como Twilio)
      // Por enquanto, vamos apenas gerar um código e mostrar no console
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      console.log(`[SIMULAÇÃO OTP] Código para ${phoneE164}: ${otpCode}`);
      
      // Armazenar temporariamente no localStorage para simulação
      localStorage.setItem(`otp_${phoneE164}`, otpCode);
      localStorage.setItem(`otp_${phoneE164}_expires`, (Date.now() + 5 * 60 * 1000).toString()); // 5 minutos
      
      setState(prev => ({ ...prev, isLoading: false, otpSent: true }));
      
      toast({
        title: "Código enviado!",
        description: `Um código de verificação foi enviado para ${phone}. Verifique suas mensagens.`,
      });
      
      // Em desenvolvimento, mostrar o código no toast também
      if (process.env.NODE_ENV === 'development') {
        setTimeout(() => {
          toast({
            title: "[DEV] Código OTP",
            description: `Código para teste: ${otpCode}`,
            duration: 10000,
          });
        }, 1000);
      }
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar código';
      setState(prev => ({ ...prev, isLoading: false, error: errorMessage }));
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      
      return false;
    }
  };

  const verifyOTP = async (phone: string, name: string, otp: string): Promise<boolean> => {
    setState(prev => ({ ...prev, isVerifying: true, error: null }));
    
    try {
      const phoneE164 = normalizePhoneToE164(phone);
      
      // Verificar OTP simulado
      const storedOTP = localStorage.getItem(`otp_${phoneE164}`);
      const expiresAt = localStorage.getItem(`otp_${phoneE164}_expires`);
      
      if (!storedOTP || !expiresAt) {
        throw new Error('Código não encontrado. Solicite um novo código.');
      }
      
      if (Date.now() > parseInt(expiresAt)) {
        localStorage.removeItem(`otp_${phoneE164}`);
        localStorage.removeItem(`otp_${phoneE164}_expires`);
        throw new Error('Código expirado. Solicite um novo código.');
      }
      
      if (storedOTP !== otp) {
        throw new Error('Código inválido. Verifique e tente novamente.');
      }
      
      // Limpar OTP usado
      localStorage.removeItem(`otp_${phoneE164}`);
      localStorage.removeItem(`otp_${phoneE164}_expires`);
      
      // Chamar Edge Function para criar/encontrar customer
      const { data, error } = await supabase.functions.invoke('find-or-create-customer', {
        body: {
          phone_e164: phoneE164,
          name: name.trim(),
        },
      });
      
      if (error) {
        console.error('Erro na Edge Function:', error);
        throw new Error('Erro ao verificar dados do cliente.');
      }
      
      if (!data.success || !data.customer_id) {
        throw new Error(data.error || 'Erro ao criar registro do cliente.');
      }
      
      setState(prev => ({
        ...prev,
        isVerifying: false,
        verified: true,
        customerId: data.customer_id,
      }));
      
      toast({
        title: "Verificação concluída!",
        description: "Seu telefone foi verificado com sucesso.",
      });
      
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao verificar código';
      setState(prev => ({ ...prev, isVerifying: false, error: errorMessage }));
      
      toast({
        title: "Erro na verificação",
        description: errorMessage,
        variant: "destructive",
      });
      
      return false;
    }
  };

  const reset = () => {
    setState({
      isLoading: false,
      isVerifying: false,
      otpSent: false,
      verified: false,
      customerId: null,
      error: null,
    });
  };

  return {
    ...state,
    sendOTP,
    verifyOTP,
    reset,
  };
};