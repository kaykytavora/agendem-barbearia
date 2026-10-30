import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type Payload = RealtimePostgresChangesPayload<Record<string, any>>;

interface UseRealtimeSubscriptionOptions {
  channelName: string;
  table: string;
  filter?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  onUpdate: (payload: Payload) => void;
  enabled?: boolean;
  /** Espera antes de conectar: se a tela sair antes disso, nenhum WebSocket chega a ser aberto. */
  delay?: number;
}

/**
 * Escuta mudanças de uma tabela pelo Supabase Realtime.
 *
 * O canal só é recriado quando muda o que ele escuta (tabela, filtro, evento). Antes, `onUpdate`
 * entrava nas dependências e, como as telas passam uma função nova a cada renderização, o canal
 * era fechado e reaberto o tempo todo; fechar antes de conectar gerava no console
 * "WebSocket is closed before the connection is established".
 */
export function useRealtimeSubscription({
  channelName,
  table,
  filter,
  event = '*',
  onUpdate,
  enabled = true,
  delay = 1000,
}: UseRealtimeSubscriptionOptions) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!enabled) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    const timeout = setTimeout(() => {
      channel = supabase
        .channel(filter ? `${channelName}:${filter}` : channelName)
        .on(
          'postgres_changes' as any,
          { event, schema: 'public', table, ...(filter ? { filter } : {}) },
          (payload: Payload) => onUpdateRef.current(payload)
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`Realtime [${channelName}]: ${status}`);
          }
        });
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (channel) supabase.removeChannel(channel);
    };
  }, [channelName, table, filter, event, enabled, delay]);
}

export default useRealtimeSubscription;
