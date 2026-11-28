import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Indica se a sessão atual ainda precisa do segundo fator (MFA ativado, mas só a senha foi informada). */
export function useNivelMfa(ativo: boolean) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["mfa-nivel", session?.access_token],
    enabled: ativo && !!session,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      return { precisaCodigo: data.nextLevel === "aal2" && data.currentLevel !== "aal2" };
    },
  });
}

/** Fatores TOTP já confirmados da conta. */
export async function fatoresAtivos() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data.totp.filter((fator) => fator.status === "verified");
}

/** Valida o código do app autenticador e eleva a sessão para aal2. */
export async function verificarCodigoMfa(codigo: string, fatorId?: string) {
  const id = fatorId ?? (await fatoresAtivos())[0]?.id;
  if (!id) throw new Error("Nenhum autenticador configurado nesta conta.");
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: id, code: codigo });
  if (error) throw new Error(/invalid|expired/i.test(error.message) ? "Código inválido ou expirado. Confira no app e tente de novo." : error.message);
}

export function useAtualizarNivelMfa() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["mfa-nivel"] });
}
