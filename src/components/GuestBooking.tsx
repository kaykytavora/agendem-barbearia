import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarIcon, Clock, Loader2, AlertTriangle, Info } from "lucide-react";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { usePhoneMask } from "@/hooks/usePhoneMask";
import { useAnonymousAppointmentLimit } from "@/hooks/useAnonymousAppointmentLimit";
import { useQueryClient } from "@tanstack/react-query";

interface GuestBookingProps {
  barbershopId: string;
  barbershopName: string;
  services: Array<{ id: string; nome: string; valor: number; duracao_minutos: number }>;
  employees: Array<{ id: string; nome: string }>;
}

export const GuestBooking = ({ barbershopId, barbershopName, services, employees }: GuestBookingProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [limitValidation, setLimitValidation] = useState<{
    canBook: boolean;
    currentCount: number;
    errorMessage?: string;
  } | null>(null);

  const queryClient = useQueryClient();
  const { value: maskedValue, handleChange } = usePhoneMask(customerPhone);
  const { checkAppointmentLimit, handleBookingError, LIMITE_AGENDAMENTOS_ANONIMOS } = useAnonymousAppointmentLimit();

  // Validar limite de agendamentos quando o telefone mudar
  useEffect(() => {
    const validateLimit = async () => {
      if (customerPhone && customerPhone.length >= 10) {
        const result = await checkAppointmentLimit(customerPhone);
        setLimitValidation(result);
      } else {
        setLimitValidation(null);
      }
    };

    const timeoutId = setTimeout(validateLimit, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [customerPhone, checkAppointmentLimit]);

  // Available time slots
  const timeSlots = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
    "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
    "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
    "17:00", "17:30", "18:00"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedDate || !selectedTime || !selectedService || !customerName || !customerPhone) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    // Validar limite antes de submeter
    const limitCheck = await checkAppointmentLimit(customerPhone);
    if (!limitCheck.canBook) {
      toast({
        title: "Limite de agendamentos atingido",
        description: limitCheck.errorMessage,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create date-time string
      const dateTimeString = `${format(selectedDate, 'yyyy-MM-dd')} ${selectedTime}:00`;
      
      const { error } = await supabase
        .from('agendamentos')
        .insert([
          {
            barbearia_id: barbershopId,
            servico_id: selectedService,
            funcionario_id: selectedEmployee || null,
            cliente_nome: customerName,
            cliente_telefone: customerPhone,
            cliente_email: customerEmail || null,
            data_hora: dateTimeString,
            user_id: null,
            status: 'confirmado',
            avaliado: false,
          }
        ]);

      if (error) {
        console.error('Erro ao criar agendamento:', error);
        
        // Usar tratamento de erro personalizado
        const errorMessage = handleBookingError(error);
        toast({
          title: "Erro ao agendar",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Agendamento criado!",
        description: "Seu agendamento foi criado com sucesso. Você receberá uma confirmação em breve.",
      });

      // Invalidate queries to update available slots
      queryClient.invalidateQueries({ queryKey: ['barbershop', barbershopId] });

      // Reset form
      setSelectedDate(undefined);
      setSelectedTime("");
      setSelectedService("");
      setSelectedEmployee("");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setLimitValidation(null);

    } catch (error) {
      console.error('Erro inesperado:', error);
      const errorMessage = handleBookingError(error);
      toast({
        title: "Erro inesperado",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedServiceData = services.find(s => s.id === selectedService);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Agendar Horário - {barbershopName}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Service Selection */}
          <div className="space-y-2">
            <Label htmlFor="service">Serviço *</Label>
            <Select value={selectedService} onValueChange={setSelectedService} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um serviço" />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.nome} - R$ {service.valor.toFixed(2)} ({service.duracao_minutos}min)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Employee Selection */}
          <div className="space-y-2">
            <Label htmlFor="employee">Profissional (opcional)</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um profissional ou deixe em branco" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Data do agendamento *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP", { locale: pt }) : "Selecione uma data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date() || date.getDay() === 0} // Disable past dates and Sundays
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Selection */}
          <div className="space-y-2">
            <Label htmlFor="time">Horário *</Label>
            <Select value={selectedTime} onValueChange={setSelectedTime} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um horário" />
              </SelectTrigger>
              <SelectContent>
                {timeSlots.map((time) => (
                  <SelectItem key={time} value={time}>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {time}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Seus dados</h3>
            
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo *</Label>
              <Input
                id="name"
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Digite seu nome completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone/WhatsApp *</Label>
              <Input
                id="phone"
                type="tel"
                value={maskedValue}
                onChange={(e) => {
                  handleChange(e);
                  setCustomerPhone(e.target.value.replace(/\D/g, ''));
                }}
                placeholder="(11) 99999-9999"
                required
              />
              
              {/* Alert de validação de limite */}
              {limitValidation && (
                <Alert variant={limitValidation.canBook ? "default" : "destructive"}>
                  {limitValidation.canBook ? (
                    <Info className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    {limitValidation.canBook ? (
                      <>
                        Você possui {limitValidation.currentCount} de {LIMITE_AGENDAMENTOS_ANONIMOS} agendamentos ativos permitidos.
                      </>
                    ) : (
                      limitValidation.errorMessage
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail (opcional)</Label>
              <Input
                id="email"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
          </div>

          {/* Summary */}
          {selectedServiceData && selectedDate && selectedTime && (
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Resumo do agendamento:</h4>
              <p><strong>Serviço:</strong> {selectedServiceData.nome}</p>
              <p><strong>Valor:</strong> R$ {selectedServiceData.valor.toFixed(2)}</p>
              <p><strong>Duração:</strong> {selectedServiceData.duracao_minutos} minutos</p>
              <p><strong>Data:</strong> {format(selectedDate, "PPP", { locale: pt })}</p>
              <p><strong>Horário:</strong> {selectedTime}</p>
              {selectedEmployee && (
                <p><strong>Profissional:</strong> {employees.find(e => e.id === selectedEmployee)?.nome}</p>
              )}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting || (limitValidation !== null && !limitValidation.canBook)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando agendamento...
              </>
            ) : limitValidation && !limitValidation.canBook ? (
              "Limite de agendamentos atingido"
            ) : (
              "Confirmar Agendamento"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};