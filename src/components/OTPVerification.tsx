import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Phone, Shield, ArrowLeft } from 'lucide-react';
import { useOTP } from '@/hooks/useOTP';

interface OTPVerificationProps {
  phone: string;
  name: string;
  onVerified: (customerId: string) => void;
  onBack: () => void;
}

export const OTPVerification: React.FC<OTPVerificationProps> = ({
  phone,
  name,
  onVerified,
  onBack,
}) => {
  const [otpCode, setOtpCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const { 
    isLoading, 
    isVerifying, 
    otpSent, 
    verified, 
    customerId, 
    error,
    sendOTP, 
    verifyOTP, 
    reset 
  } = useOTP();

  // Countdown timer para reenvio
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  // Auto-enviar OTP quando componente monta
  useEffect(() => {
    if (!otpSent && !isLoading) {
      handleSendOTP();
    }
  }, []);

  // Quando verificação é bem-sucedida
  useEffect(() => {
    if (verified && customerId) {
      onVerified(customerId);
    }
  }, [verified, customerId, onVerified]);

  const handleSendOTP = async () => {
    const success = await sendOTP(phone, name);
    if (success) {
      setCountdown(60); // 60 segundos para reenvio
      setOtpCode('');
    }
  };

  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6) {
      return;
    }
    await verifyOTP(phone, name, otpCode);
  };

  const handleBack = () => {
    reset();
    onBack();
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-blue-100 rounded-full">
          <Shield className="w-6 h-6 text-blue-600" />
        </div>
        <CardTitle className="text-xl">Verificação de Telefone</CardTitle>
        <CardDescription>
          Enviamos um código de verificação para confirmar seu número
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Informações do telefone */}
        <div className="flex items-center justify-center p-3 bg-gray-50 rounded-lg">
          <Phone className="w-4 h-4 mr-2 text-gray-600" />
          <span className="font-medium">{formatPhone(phone)}</span>
        </div>

        {/* Status do envio */}
        {isLoading && (
          <div className="flex items-center justify-center p-4 text-blue-600">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            <span>Enviando código...</span>
          </div>
        )}

        {otpSent && !verified && (
          <>
            {/* Campo de entrada do código */}
            <div className="space-y-2">
              <Label htmlFor="otp">Código de verificação</Label>
              <Input
                id="otp"
                type="text"
                placeholder="000000"
                value={otpCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtpCode(value);
                }}
                maxLength={6}
                className="text-center text-lg tracking-widest"
                autoComplete="one-time-code"
                autoFocus
              />
              <p className="text-sm text-gray-600 text-center">
                Digite o código de 6 dígitos enviado por SMS
              </p>
            </div>

            {/* Botão de verificação */}
            <Button
              onClick={handleVerifyOTP}
              disabled={otpCode.length !== 6 || isVerifying}
              className="w-full"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Verificar Código'
              )}
            </Button>

            {/* Reenviar código */}
            <div className="text-center">
              {countdown > 0 ? (
                <p className="text-sm text-gray-600">
                  Reenviar código em {countdown}s
                </p>
              ) : (
                <Button
                  variant="ghost"
                  onClick={handleSendOTP}
                  disabled={isLoading}
                  className="text-sm"
                >
                  Não recebeu? Reenviar código
                </Button>
              )}
            </div>
          </>
        )}

        {/* Mensagem de erro */}
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
            {error}
          </div>
        )}

        {/* Verificação concluída */}
        {verified && (
          <div className="p-4 text-center text-green-600 bg-green-50 rounded-lg">
            <Shield className="w-6 h-6 mx-auto mb-2" />
            <p className="font-medium">Telefone verificado com sucesso!</p>
            <p className="text-sm">Redirecionando...</p>
          </div>
        )}

        {/* Botão voltar */}
        <Button
          variant="outline"
          onClick={handleBack}
          className="w-full"
          disabled={isLoading || isVerifying}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        {/* Informações de segurança */}
        <div className="p-3 text-xs text-gray-600 bg-gray-50 rounded-lg">
          <p className="font-medium mb-1">🔒 Sua privacidade é importante</p>
          <p>
            Usamos verificação por SMS apenas para confirmar seu número e 
            garantir a segurança dos agendamentos. Seus dados não serão 
            compartilhados com terceiros.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};