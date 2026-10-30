 
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Bell } from 'lucide-react';
import { useToast } from '../ui/use-toast';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

// Definição do tipo para uma notificação
interface Notification {
  id: string;
  message: string;
  read: boolean;
  data: Record<string, unknown>;
}

export function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [barbeariaId, setBarbeariaId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const unreadCount = notifications.filter(n => !n.read).length;

  // Buscar o ID da barbearia do usuário logado
  useEffect(() => {
    const fetchBarbeariaId = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase.rpc('get_user_barbearia_id', { 
          user_uuid: user.id 
        });
        
        if (error) {
          console.error('Erro ao buscar barbearia ID:', error);
          return;
        }
        
        setBarbeariaId(data);
      } catch (error) {
        console.error('Erro ao buscar barbearia ID:', error);
      }
    };

    fetchBarbeariaId();
  }, [user]);

  // Mesma chave de cache da aba Configurações > Avisos: ligar/desligar o som lá vale aqui na hora
  const { data: notificationSettings } = useQuery({
    queryKey: ['notification-settings', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('barbearias')
        .select('notificacoes_ativa')
        .eq('id', barbeariaId!)
        .maybeSingle();
      return { notificacoes_ativa: data?.notificacoes_ativa ?? true };
    },
    enabled: !!barbeariaId,
  });
  const somAtivo = notificationSettings?.notificacoes_ativa ?? true;

  // Cada página monta o próprio DashboardLayout, então este sino é desmontado a cada navegação.
  // O atraso do hook evita abrir (e logo fechar) o WebSocket quando a pessoa só está passando pela tela.
  useRealtimeSubscription({
    channelName: 'agendamentos-notifications',
    table: 'agendamentos',
    event: 'INSERT',
    filter: barbeariaId ? `barbearia_id=eq.${barbeariaId}` : undefined,
    enabled: !!barbeariaId,
    onUpdate: (payload) => {
      const newAppointment = payload.new as Record<string, unknown> & { id: string; cliente_nome?: string };
      const newNotification: Notification = {
        id: newAppointment.id,
        message: `Novo agendamento de ${newAppointment.cliente_nome || 'um cliente'}`,
        read: false,
        data: newAppointment,
      };

      setNotifications(prev => [newNotification, ...prev]);
      if (somAtivo) audioRef.current?.play().catch(e => console.error("Erro ao tocar som:", e));
      toast({
        title: "Nova Notificação",
        description: newNotification.message,
      });
    },
  });

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Marcar todas como lidas ao fechar o popover
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    }
  };

  return (
    <>
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-ping"></span>
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full"></span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Notificações</h4>
              <p className="text-sm text-muted-foreground">
                Você tem {unreadCount} {unreadCount === 1 ? 'nova notificação' : 'novas notificações'}.
              </p>
            </div>
            <div className="grid gap-2">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <Link
                    to={`/dashboard/agendamentos?highlight=${notification.id}&date=${encodeURIComponent(notification.data.data_hora as string)}`}
                    key={notification.id}
                    className="block"
                    onClick={() => handleOpenChange(false)}
                  >
                    <div
                      className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50"
                    >
                      {!notification.read && <span className="w-2 h-2 mt-1.5 bg-primary rounded-full" />}
                      <div className={notification.read ? 'pl-4' : ''}>
                        <p className="text-sm font-medium">{notification.message}</p>
                        {/* <p className="text-xs text-muted-foreground">
                          {new Date(notification.data.data_agendamento).toLocaleString()}
                        </p> */}
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma notificação ainda.</p>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}