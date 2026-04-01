import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Volume2, VolumeX, Bell, BellOff, Play, Zap, Check } from 'lucide-react';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const NotificationSound = () => {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  const { user } = useAuth();
  const { role } = useUserRole();
  const queryClient = useQueryClient();

  // Only enable for admin and funcionario roles
  const shouldSubscribe = user && (role === 'admin' || role === 'funcionario');

  // Function to get barbearia ID
  const getBarbeariaId = useCallback(async () => {
    if (!user) return null;

    try {
      const { data, error } = await supabase.rpc('get_user_barbearia_id', {
        user_uuid: user.id
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching barbearia ID:', error);
      return null;
    }
  }, [user]);

  // Fetch notification settings - fallback to localStorage if DB column doesn't exist
  const { data: notificationSettings } = useQuery({
    queryKey: ['notification-settings', user?.id],
    queryFn: async () => {
      const barbeariaId = await getBarbeariaId();
      if (!barbeariaId) return { notificacoes_ativa: true };

      try {
        const { data, error } = await supabase
          .from('barbearias')
          .select('notificacoes_ativa')
          .eq('id', barbeariaId)
          .maybeSingle();

        if (error) {
          // If column doesn't exist, check localStorage
          const stored = localStorage.getItem(`notifications_${barbeariaId}`);
          return { notificacoes_ativa: stored ? JSON.parse(stored) : true };
        }

        return data || { notificacoes_ativa: true };
      } catch (error) {
        console.error('Error fetching notification settings:', error);
        // Fallback to localStorage
        const stored = localStorage.getItem(`notifications_${barbeariaId}`);
        return { notificacoes_ativa: stored ? JSON.parse(stored) : true };
      }
    },
    enabled: shouldSubscribe !== null && shouldSubscribe !== false,
  });

  const soundEnabled = notificationSettings?.notificacoes_ativa ?? true;

  // Mutation to update notification settings - fallback to localStorage if DB column doesn't exist
  const updateNotificationSettings = useMutation({
    mutationFn: async (enabled: boolean) => {
      const barbeariaId = await getBarbeariaId();
      if (!barbeariaId) throw new Error('No barbearia ID');

      try {
        const { error } = await supabase
          .from('barbearias')
          .update({ notificacoes_ativa: enabled })
          .eq('id', barbeariaId);

        if (error) {
          // If column doesn't exist, save to localStorage
          localStorage.setItem(`notifications_${barbeariaId}`, JSON.stringify(enabled));
          return { notificacoes_ativa: enabled };
        }

        return { notificacoes_ativa: enabled };
      } catch (error) {
        // Fallback to localStorage if DB update fails
        localStorage.setItem(`notifications_${barbeariaId}`, JSON.stringify(enabled));
        return { notificacoes_ativa: enabled };
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['notification-settings', user?.id], data);
      toast({
        title: data.notificacoes_ativa ? "Som habilitado" : "Som desabilitado",
        description: data.notificacoes_ativa
          ? "Você receberá notificações sonoras para novos agendamentos."
          : "As notificações sonoras foram desabilitadas.",
      });
    },
    onError: (error) => {
      console.error('Error updating notification settings:', error);
      toast({
        title: "Erro ao salvar configuração",
        description: "Não foi possível salvar a configuração de notificações.",
        variant: "destructive",
      });
    },
  });

  const playNotificationSound = async () => {
    if (!audioContext || !soundEnabled) return;

    try {
      // Create a simple notification beep
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

  // Subscribe to new appointments
  useRealtimeSubscription({
    channelName: 'appointments-notifications',
    table: 'agendamentos',
    onUpdate: (payload) => {
      if (payload.eventType === 'INSERT') {
        // Play sound notification
        playNotificationSound();
        
        // Show toast notification
        toast({
          title: "Novo Agendamento!",
          description: `${payload.new.cliente_nome} agendou um horário.`,
          duration: 5000,
        });
      }
    },
    enabled: !!shouldSubscribe
  });

  const enableAudio = async () => {
    try {
      // Request user interaction to enable audio
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Resume audio context if suspended
      if (context.state === 'suspended') {
        await context.resume();
      }
      
      setAudioContext(context);
      setAudioEnabled(true);
      
      toast({
        title: "Áudio habilitado",
        description: "Você receberá notificações sonoras para novos agendamentos.",
      });
    } catch (error) {
      console.error('Error enabling audio:', error);
      toast({
        title: "Erro ao habilitar áudio",
        description: "Não foi possível habilitar as notificações sonoras.",
        variant: "destructive",
      });
    }
  };

  const toggleSound = (enabled: boolean) => {
    updateNotificationSettings.mutate(enabled);
  };

  const testNotificationSound = () => {
    playNotificationSound();
    toast({
      title: "🔊 Som de teste reproduzido",
      description: "Este é o som que você ouvirá para novos agendamentos.",
    });
  };

  // Don't render for clients
  if (!shouldSubscribe) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl ${soundEnabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-800'} transition-colors`}>
            {soundEnabled ? (
              <Bell className="h-6 w-6 text-green-600 dark:text-green-400" />
            ) : (
              <BellOff className="h-6 w-6 text-gray-500" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold">Notificações Sonoras</h3>
            <p className="text-sm text-muted-foreground">Configure alertas para novos agendamentos</p>
          </div>
        </div>
        <Badge
          variant={soundEnabled ? "default" : "secondary"}
          className={`${soundEnabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''} transition-colors`}
        >
          {soundEnabled ? 'Ativo' : 'Inativo'}
        </Badge>
      </div>

      {/* Main Control Card */}
      <Card className="border-2 transition-all duration-300 hover:shadow-lg">
        <CardContent className="p-6">
          {!audioEnabled && soundEnabled ? (
            /* Audio Enable Section - só mostra se som está ativo mas áudio não foi habilitado */
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center">
                <Volume2 className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-semibold">Ativar Notificações de Áudio</h4>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Clique no botão abaixo para habilitar o áudio e receber notificações sonoras sempre que um cliente fizer um novo agendamento.
                </p>
              </div>
              <Button
                onClick={enableAudio}
                className="w-full sm:w-auto px-8 py-3 text-base font-medium bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-300 transform hover:scale-105"
              >
                <Zap className="w-5 h-5 mr-2" />
                Habilitar Áudio
              </Button>
            </div>
          ) : (
            /* Audio Controls Section */
            <div className="space-y-6">
              {/* Main Toggle */}
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${soundEnabled ? 'bg-primary text-primary-foreground' : 'bg-muted'} transition-colors`}>
                    {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                  </div>
                  <div>
                    <Label htmlFor="sound-toggle" className="text-base font-medium cursor-pointer">
                      Notificações Sonoras
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {soundEnabled ? 'Você receberá alertas sonoros' : 'Alertas sonoros desativados'}
                    </p>
                  </div>
                </div>
                <Switch
                  id="sound-toggle"
                  checked={soundEnabled}
                  onCheckedChange={(checked) => {
                    toggleSound(checked);
                    // Se ativar e áudio ainda não foi habilitado, habilitar automaticamente
                    if (checked && !audioEnabled) {
                      enableAudio();
                    }
                  }}
                  disabled={updateNotificationSettings.isPending}
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              {/* Test Sound Button */}
              {soundEnabled && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={testNotificationSound}
                    className="flex-1 h-12 border-2 hover:border-primary/50 transition-all duration-300"
                    disabled={!audioContext}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Testar Som
                  </Button>
                  <div className="flex-1 flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-200 dark:border-green-800">
                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm text-green-700 dark:text-green-300 font-medium">
                      Sistema ativo e funcionando
                    </span>
                  </div>
                </div>
              )}

              {/* Info Section */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                  <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Como funciona?
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Quando um cliente fizer um agendamento, você ouvirá um som de notificação discreto para ser alertado imediatamente.
                    </p>
                  </div>
                </div>

                {updateNotificationSettings.isPending && (
                  <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-orange-700 dark:text-orange-300">
                      Salvando configuração...
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};