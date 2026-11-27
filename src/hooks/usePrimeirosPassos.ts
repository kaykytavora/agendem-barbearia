import { useCallback, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { lerPrimeirosPassos, type PrimeirosPassos } from "@/lib/primeiros-passos";

/**
 * Andamento do passo a passo de primeiro acesso, salvo em profiles.primeiros_passos.
 * `estado` é null quando não há perfil ou a coluna ainda não existe no banco.
 */
export function usePrimeirosPassos() {
  const { profile, refreshProfile } = useAuth();
  // Mostra a mudança na hora, sem esperar o banco responder
  const [otimista, setOtimista] = useState<PrimeirosPassos | null>(null);

  const doBanco = lerPrimeirosPassos(profile?.primeiros_passos);
  const estado = doBanco && otimista ? otimista : doBanco;
  const userId = profile?.user_id;

  const salvar = useCallback(
    async (novo: PrimeirosPassos) => {
      if (!userId) return;
      setOtimista(novo);
      const { error } = await supabase.from("profiles").update({ primeiros_passos: novo }).eq("user_id", userId);
      if (error) {
        logger.error("Erro ao salvar primeiros passos", error);
        return;
      }
      await refreshProfile();
    },
    [userId, refreshProfile]
  );

  return { estado, salvar };
}
