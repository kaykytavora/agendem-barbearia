import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeSubscriptionOptions {
  channelName: string;
  table: string;
  filter?: string;
  onUpdate: (payload: any) => void;
  enabled?: boolean;
  delay?: number;
}

export function useRealtimeSubscription({
  channelName,
  table,
  filter,
  onUpdate,
  enabled = true,
  delay = 1000
}: UseRealtimeSubscriptionOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      // Cleanup if disabled
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isConnectedRef.current = false;
      }
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Delay the connection to avoid WebSocket issues
    timeoutRef.current = setTimeout(() => {
      try {
        // Remove existing channel if any
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
        }

        // Create new channel
        const channel = supabase.channel(channelName);
        
        // Configure postgres changes listener
        const config: any = {
          event: '*',
          schema: 'public',
          table
        };
        
        if (filter) {
          config.filter = filter;
        }

        channel.on('postgres_changes', config, (payload) => {
          onUpdate(payload);
        });

        // Subscribe with status callback
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            isConnectedRef.current = true;
          } else if (status === 'CHANNEL_ERROR') {
            isConnectedRef.current = false;
            console.warn(`❌ Erro na conexão Realtime [${channelName}]:`, status);
          } else if (status === 'TIMED_OUT') {
            isConnectedRef.current = false;
            console.warn(`⏰ Timeout na conexão Realtime [${channelName}]`);
          } else if (status === 'CLOSED') {
            isConnectedRef.current = false;
          }
        });

        channelRef.current = channel;
      } catch (error) {
        console.error(`Erro ao configurar Realtime [${channelName}]:`, error);
      }
    }, delay);

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isConnectedRef.current = false;
      }
    };
  }, [channelName, table, filter, onUpdate, enabled, delay]);

  return {
    isConnected: isConnectedRef.current,
    channel: channelRef.current
  };
}

export default useRealtimeSubscription;