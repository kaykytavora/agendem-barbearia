import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useResponsive } from "@/hooks/use-mobile";
import { useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { generatePDFReceipt } from "@/lib/receipt";
import { 
  CheckCircle, 
  Calendar, 
  MapPin, 
  Clock, 
  User, 
  Phone,
  Star,
  Download,
  Plus,
  UserCircle
} from "lucide-react";

const BookingConfirmation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const confirmationRef = useRef<HTMLDivElement>(null);
  
  const bookingData = location.state;
  const isUserAuthenticated = !!user;

  if (!bookingData) {
    navigate('/');
    return null;
  }

  const downloadConfirmation = async () => {
    try {

      // Converter dados do booking para formato esperado pelo PDFGenerator
      const appointmentData = {
        id: bookingData.appointmentId || `TEMP-${Date.now()}`,
        cliente_nome: bookingData.booking?.name || 'Cliente',
        cliente_telefone: bookingData.booking?.phone || '',
        cliente_email: bookingData.booking?.email || '',
        data_hora: `${bookingData.booking?.date}T${bookingData.booking?.time}:00`,
        status: 'confirmado',
        servico: {
          nome: bookingData.service?.name || 'Serviço',
          valor: parseFloat(bookingData.service?.price || '0'),
          duracao_minutos: bookingData.service?.duration || 30
        },
        funcionario: bookingData.barber ? {
          nome: bookingData.barber.name
        } : undefined,
        barbearia: {
          nome: bookingData.barberShop?.name || 'Barbearia',
          endereco: bookingData.barberShop?.location || '',
          telefone: bookingData.barberShop?.phone || '',
          logo_url: bookingData.barberShop?.logo_url
        }
      };

      await generatePDFReceipt(appointmentData);
    } catch (error) {
      console.error('Erro ao gerar comprovante PDF:', error);
      // Fallback para a versão anterior em caso de erro
      fallbackDownload();
    }
  };

  const fallbackDownload = async () => {
    if (confirmationRef.current) {
      try {
        const { default: html2canvas } = await import("html2canvas");
        const canvas = await html2canvas(confirmationRef.current, {
          backgroundColor: '#0a0a0a',
          scale: 2,
          useCORS: true,
          allowTaint: true
        });
        
        const link = document.createElement('a');
        link.download = `agendamento-${bookingData.barberShop.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL();
        link.click();
      } catch (error) {
        console.error('Erro ao baixar comprovante:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-4">
      <div className={`w-full ${isMobile ? 'max-w-sm' : 'max-w-2xl'}`} ref={confirmationRef}>
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className={`${isMobile ? 'w-16 h-16' : 'w-20 h-20'} bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4`}>
            <CheckCircle className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} text-green-500`} />
          </div>
          <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-green-500 mb-2`}>Agendamento Confirmado!</h1>
          <p className={`text-muted-foreground ${isMobile ? 'text-sm' : ''}`}>
            Seu horário foi reservado com sucesso
          </p>
        </div>

        {/* Booking Details */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm mb-6">
          <CardHeader className={isMobile ? 'p-4' : ''}>
            <CardTitle className={`text-center ${isMobile ? 'text-lg' : ''}`}>Detalhes do seu Agendamento</CardTitle>
          </CardHeader>
          <CardContent className={`${isMobile ? 'space-y-4 p-4' : 'space-y-6'}`}>
            {/* Barber Shop Info */}
            <div className="text-center border-b pb-4">
              <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold`}>{bookingData.barberShop.name}</h3>
              <div className="flex items-center justify-center gap-1 text-muted-foreground mt-1">
                <MapPin className="w-4 h-4" />
                <span className={`${isMobile ? 'text-xs' : 'text-sm'}`}>{bookingData.barberShop.location}</span>
              </div>
              <div className="flex items-center justify-center gap-1 text-muted-foreground mt-1">
                <Phone className="w-4 h-4" />
                <span className={`${isMobile ? 'text-xs' : 'text-sm'}`}>{bookingData.barberShop.phone}</span>
              </div>
            </div>

            {/* Appointment Details */}
            <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'grid-cols-2 gap-4'}`}>
              <div className={`${isMobile ? 'space-y-3' : 'space-y-4'}`}>
                <div className="flex items-center gap-3">
                  <Calendar className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-primary`} />
                  <div>
                    <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>Data</p>
                    <p className={`font-medium ${isMobile ? 'text-sm' : ''}`}>
                      {new Date(bookingData.booking.date).toLocaleDateString('pt-BR', { 
                        weekday: isMobile ? 'short' : 'long', 
                        year: 'numeric', 
                        month: isMobile ? 'short' : 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-primary`} />
                  <div>
                    <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>Horário</p>
                    <p className={`font-medium ${isMobile ? 'text-sm' : ''}`}>{bookingData.booking.time}</p>
                  </div>
                </div>
              </div>

              <div className={`${isMobile ? 'space-y-3' : 'space-y-4'}`}>
                <div className="flex items-center gap-3">
                  <User className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'} text-primary`} />
                  <div>
                    <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>Cliente</p>
                    <p className={`font-medium ${isMobile ? 'text-sm' : ''}`}>{bookingData.booking.name}</p>
                  </div>
                </div>

                <div>
                  <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>Serviço</p>
                  <p className={`font-medium ${isMobile ? 'text-sm' : ''}`}>{bookingData.service.name}</p>
                  <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
                    {bookingData.service.duration}min • R$ {bookingData.service.price}
                  </p>
                </div>
              </div>
            </div>

            {bookingData.barber && (
              <div className="border-t pt-4">
                <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>Profissional escolhido</p>
                <p className={`font-medium ${isMobile ? 'text-sm' : ''}`}>{bookingData.barber.name}</p>
                <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground`}>{bookingData.barber.specialty}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Important Info */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm mb-6">
          <CardHeader className={isMobile ? 'p-4' : ''}>
            <CardTitle className={`${isMobile ? 'text-base' : 'text-lg'}`}>Informações Importantes</CardTitle>
          </CardHeader>
          <CardContent className={`${isMobile ? 'space-y-2 text-xs p-4' : 'space-y-3 text-sm'}`}>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
              <p>Você receberá uma confirmação por WhatsApp no número {bookingData.booking.phone}</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
              <p>Chegue com 10 minutos de antecedência</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
              <p>Para cancelamentos ou reagendamentos, entre em contato pelo WhatsApp</p>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
              <p>Pagamento pode ser feito no local (dinheiro, cartão ou PIX)</p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className={`${isMobile ? 'space-y-2' : 'space-y-3'}`}>
          {/* Botão Baixar Comprovante - sempre visível */}
          <Button 
            variant="outline" 
            className={`w-full ${isMobile ? 'h-10 text-sm' : ''}`}
            onClick={downloadConfirmation}
          >
            <Download className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-2`} />
            Baixar Comprovante
          </Button>
          
          {/* Botões condicionais baseados no tipo de usuário */}
          {isUserAuthenticated ? (
            <>
              {/* Usuário Autenticado: Voltar para Meu Painel */}
              <Button 
                variant="premium" 
                className={`w-full ${isMobile ? 'h-10 text-sm' : ''}`}
                onClick={() => navigate('/dashboard/client-panel')}
              >
                <UserCircle className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-2`} />
                Voltar para Meu Painel
              </Button>
              
              {/* Usuário Autenticado: Fazer Novo Agendamento também */}
              <Button 
                variant="outline" 
                className={`w-full ${isMobile ? 'h-10 text-sm' : ''}`}
                onClick={() => navigate('/barbearias')}
              >
                <Plus className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-2`} />
                Fazer Novo Agendamento
              </Button>
            </>
          ) : (
            /* Usuário Anônimo: Apenas Fazer Novo Agendamento */
            <Button 
              variant="premium" 
              className={`w-full ${isMobile ? 'h-10 text-sm' : ''}`}
              onClick={() => navigate('/barbearias')}
            >
              <Plus className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-2`} />
              Fazer Novo Agendamento
            </Button>
          )}
          
          {/* Botão adicional para usuários anônimos criarem conta */}
          {!isUserAuthenticated && bookingData.booking.createAccount && (
            <Button 
              variant="outline" 
              className={`w-full ${isMobile ? 'h-10 text-sm' : ''}`}
              onClick={() => navigate('/cadastro-cliente')}
            >
              <User className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-2`} />
              Criar Minha Conta
            </Button>
          )}

          <div className={`text-center ${isMobile ? 'pt-3' : 'pt-4'}`}>
            <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-muted-foreground mb-2`}>
              Gostou do atendimento? Deixe sua avaliação!
            </p>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star 
                  key={star}
                  className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-yellow-400 cursor-pointer hover:fill-yellow-400`} 
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmation;