import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePhoneMask } from "@/hooks/usePhoneMask";
import { useResponsive, useResponsiveClasses } from "@/hooks/use-mobile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle,
  Loader2
} from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import { createAppointment } from "@/integrations/supabase/api";

interface BookingData {
  barberShop: Database['public']['Tables']['barbearias']['Row'];
  service: Database['public']['Tables']['servicos']['Row'];
  barber?: Database['public']['Tables']['funcionarios']['Row'];
  date: Date;
  time: string;
  clientData: {
    name: string;
    phone: string;
    email: string;
  };
}

const Booking = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { isMobile } = useResponsive();
  const responsive = useResponsiveClasses();
  
  // Hooks devem ser chamados antes de qualquer early return
  const { value: phoneValue, handleChange: handlePhoneChange } = usePhoneMask(profile?.phone || "");
  const [formData, setFormData] = useState({
    name: profile?.name || "",
    email: user?.email || "",
    date: "",
    time: "",
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Se não houver dados de agendamento na navegação, volta para a lista de barbearias
  const bookingData = location.state as BookingData;
  if (!bookingData) {
    navigate('/barbearias');
    return null; 
  }

  // MOCK - Idealmente, isso viria da API da barbearia
  const generateAvailableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const availableDates = generateAvailableDates();
  const availableTimes = [ "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00" ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.date || !formData.time) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive"
      });
      return;
    }

    // Validação dos campos obrigatórios para usuários não autenticados
    if (!user && (!formData.name || !phoneValue || !formData.email)) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha nome, telefone e email.",
        variant: "destructive"
      });
      return;
    }

    // Validação do telefone
    const unmaskedPhone = (phoneValue || '').replace(/\D/g, '');
    if (unmaskedPhone.length < 10) { // Mínimo para (XX) XXXX-XXXX
        toast({
            title: "Telefone inválido",
            description: "Por favor, insira um número de telefone válido.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const [hour, minute] = formData.time.split(':');
      const dataHora = new Date(formData.date);
      dataHora.setHours(parseInt(hour), parseInt(minute), 0, 0);

      const appointmentData = {
        barbearia_id: bookingData.barberShop.id,
        servico_id: bookingData.service.id,
        funcionario_id: bookingData.barber?.id || null,
        data_hora: dataHora.toISOString(),
        cliente_nome: user ? profile?.name || formData.name : formData.name,
        cliente_telefone: user ? profile?.phone || phoneValue : phoneValue,
        cliente_email: user ? user.email || formData.email : formData.email,
        user_id: user ? user.id : null,
        avaliado: false,
      };

      await createAppointment(appointmentData);

      toast({
        title: "Agendamento confirmado!",
        description: "Seu horário foi reservado com sucesso.",
        action: <CheckCircle className="text-green-500" />,
      });

      // Redirecionar baseado no status do usuário
      if (user) {
        navigate('/client-panel');
      } else {
        navigate('/barbearias');
      }

    } catch (error) {
      console.error("Erro ao criar agendamento:", error);
      toast({
        title: "Erro no Agendamento",
        description: "Não foi possível confirmar seu agendamento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!bookingData) {
    navigate('/barbearias');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-bg">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className={`max-w-4xl mx-auto ${responsive.containerPadding} ${isMobile ? 'py-3' : 'py-4'}`}>
          <div className={`flex items-center ${isMobile ? 'gap-3' : 'gap-4'}`}>
            <Button 
              variant="ghost" 
              size={isMobile ? "sm" : "icon"}
              onClick={() => navigate(-1)}
              className="touch-target"
            >
              <ArrowLeft className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4'}`} />
            </Button>
            <div>
              <h1 className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold`}>Finalizar Agendamento</h1>
              <p className={`text-muted-foreground ${isMobile ? 'text-sm' : ''}`}>{bookingData.barberShop.nome}</p>
            </div>
          </div>
        </div>
      </div>

      <div className={`max-w-4xl mx-auto ${responsive.containerPadding} ${isMobile ? 'py-4' : 'py-8'}`}>
        <div className={`grid ${!isMobile ? 'lg:grid-cols-3' : 'grid-cols-1'} ${isMobile ? 'gap-4' : 'gap-8'}`}>
          {/* Form */}
          <div className={`${!isMobile ? 'lg:col-span-2' : ''} ${isMobile ? 'order-2' : ''}`}>
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className={responsive.card.padding}>
                <CardTitle className={responsive.heading.h2}>Dados do Agendamento</CardTitle>
              </CardHeader>
              <CardContent className={responsive.card.padding}>
                <form onSubmit={handleSubmit} className={`space-y-6 ${isMobile ? 'space-y-4' : ''}`}>
                  {/* Date Selection */}
                  <div>
                    <Label className={`${isMobile ? 'text-sm' : 'text-base'} font-medium ${isMobile ? 'mb-2' : 'mb-3'} block`}>
                      <Calendar className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} inline mr-2`} />
                      Escolha a data
                    </Label>
                    <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-3 sm:grid-cols-4'} gap-2`}>
                      {availableDates.map((dateOption) => (
                        <Button
                          key={dateOption.toISOString()}
                          type="button"
                          variant={formData.date === dateOption.toISOString().split('T')[0] ? "default" : "outline"}
                          size={isMobile ? "sm" : "sm"}
                          className={`flex-col h-auto ${isMobile ? 'py-2 px-2' : 'py-3'} touch-target`}
                          onClick={() => setFormData(prev => ({ ...prev, date: dateOption.toISOString().split('T')[0] }))}
                        >
                          <span className={`${isMobile ? 'text-xs' : 'text-xs'} font-bold`}>{dateOption.toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
                          <span className={`${isMobile ? 'text-base' : 'text-lg'}`}>
                            {dateOption.getDate()}
                          </span>
                          <span className={`${isMobile ? 'text-xs' : 'text-xs'} opacity-70`}>
                            {dateOption.toLocaleDateString('pt-BR', { month: 'short' })}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Time Selection */}
                  <div>
                    <Label className={`${isMobile ? 'text-sm' : 'text-base'} font-medium ${isMobile ? 'mb-2' : 'mb-3'} block`}>
                      <Clock className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} inline mr-2`} />
                      Escolha o horário
                    </Label>
                    <div className={`grid ${isMobile ? 'grid-cols-3' : 'grid-cols-4'} gap-2`}>
                      {availableTimes.map((time) => (
                        <Button
                          key={time}
                          type="button"
                          variant={formData.time === time ? "default" : "outline"}
                          size={isMobile ? "sm" : "sm"}
                          className={`${isMobile ? 'h-10 text-sm' : ''} touch-target`}
                          onClick={() => setFormData(prev => ({ ...prev, time }))}
                        >
                          {time}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Personal Data */}
                  <div className={`space-y-4 ${isMobile ? 'space-y-3' : ''} ${isMobile ? 'pt-3' : 'pt-4'} border-t`}>
                    <Label className={`${isMobile ? 'text-sm' : 'text-base'} font-medium`}>
                      <User className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} inline mr-2`} />
                      Seus dados
                    </Label>

                    {profile ? (
                      <div className={`flex items-center ${isMobile ? 'gap-3' : 'gap-4'} ${isMobile ? 'pt-1' : 'pt-2'}`}>
                        <Avatar className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'}`}>
                          <AvatarImage src={user?.user_metadata?.avatar_url} alt={profile.name} />
                          <AvatarFallback>
                            {profile.name?.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className={`font-semibold ${isMobile ? 'text-sm' : ''}`}>{profile.name}</p>
                          <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>{user?.email}</p>
                          <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>{profile.phone}</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={`${isMobile ? 'text-xs' : 'text-sm'} ${isMobile ? 'p-3' : 'p-4'} bg-blue-900/10 border border-blue-500/20 rounded-lg`}>
                          <p>Você não está logado. <a href="/client-login" className="text-primary hover:underline">Faça login</a> ou continue para criar uma conta automaticamente.</p>
                        </div>
                        <div>
                          <Label htmlFor="name" className={isMobile ? 'text-sm' : ''}>Nome Completo</Label>
                            <Input
                              id="name"
                              type="text"
                              value={formData.name}
                              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                              required
                              placeholder="Seu nome completo"
                              className={`${isMobile ? 'h-12 text-base' : ''} touch-target`}
                            />
                        </div>
                        <div>
                          <Label htmlFor="phone" className={isMobile ? 'text-sm' : ''}>Telefone/WhatsApp</Label>
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="(99) 99999-9999"
                            value={phoneValue}
                            onChange={handlePhoneChange}
                            required
                            className={`${isMobile ? 'h-12 text-base' : ''} touch-target`}
                          />
                        </div>
                        <div>
                          <Label htmlFor="email" className={isMobile ? 'text-sm' : ''}>E-mail</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="seu@email.com"
                            value={formData.email}
                            onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                            required
                            className={`${isMobile ? 'h-12 text-base' : ''} touch-target`}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className={`w-full ${isMobile ? 'text-base h-12' : 'text-lg py-6'} touch-target`}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} animate-spin mr-2`} />
                    ) : (
                      <CheckCircle className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} mr-2`} />
                    )}
                    {isSubmitting ? "Confirmando..." : "Confirmar Agendamento"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <div className={`${isMobile ? 'order-1' : ''}`}>
            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader className={responsive.card.padding}>
                <CardTitle className={responsive.heading.h3}>Resumo do Agendamento</CardTitle>
              </CardHeader>
              <CardContent className={`space-y-4 ${responsive.card.padding} ${isMobile ? 'space-y-3' : ''}`}>
                 <div>
                   <h4 className={`font-medium ${isMobile ? 'text-sm' : ''}`}>{bookingData.barberShop.nome}</h4>
                   <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>{bookingData.barberShop.endereco}, {bookingData.barberShop.cidade}</p>
                 </div>

                <div className={`border-t ${isMobile ? 'pt-3 space-y-2' : 'pt-4 space-y-3'}`}>
                   <div className="flex justify-between">
                     <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>Serviço:</span>
                     <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>{bookingData.service.nome}</span>
                   </div>
                   
                   <div className="flex justify-between">
                     <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>Duração:</span>
                     <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>{bookingData.service.duracao_minutos}min</span>
                   </div>

                   {bookingData.barber && (
                     <div className="flex justify-between">
                       <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>Profissional:</span>
                       <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>{bookingData.barber.nome}</span>
                     </div>
                   )}

                  {formData.date && (
                    <div className="flex justify-between">
                      <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>Data:</span>
                      <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>
                        {new Date(formData.date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  )}

                  {formData.time && (
                    <div className="flex justify-between">
                      <span className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>Horário:</span>
                      <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-medium`}>{formData.time}</span>
                    </div>
                  )}
                </div>

                <div className={`border-t ${isMobile ? 'pt-3' : 'pt-4'}`}>
                  <div className={`flex justify-between font-semibold ${isMobile ? 'text-sm' : ''}`}>
                    <span>Total:</span>
                    <span className="text-primary">R$ {bookingData.service.valor}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Booking;