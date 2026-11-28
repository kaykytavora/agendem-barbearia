import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Barbearias favoritas do usuário logado (vazio para visitantes). */
export function useFavoritas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const chave = ["barbearias-favoritas", user?.id];

  const { data: favoritas = new Set<string>() } = useQuery({
    queryKey: chave,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("barbearias_favoritas").select("barbearia_id");
      if (error) throw error;
      return new Set(data.map((f) => f.barbearia_id));
    },
  });

  const alternar = useMutation({
    mutationFn: async (barbeariaId: string) => {
      if (favoritas.has(barbeariaId)) {
        const { error } = await supabase.from("barbearias_favoritas").delete().eq("barbearia_id", barbeariaId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("barbearias_favoritas").insert({ barbearia_id: barbeariaId });
        if (error) throw error;
      }
    },
    // Atualiza o coração na hora; se der erro, volta ao estado anterior
    onMutate: async (barbeariaId) => {
      await queryClient.cancelQueries({ queryKey: chave });
      const anterior = queryClient.getQueryData<Set<string>>(chave);
      const proximo = new Set(anterior);
      if (proximo.has(barbeariaId)) proximo.delete(barbeariaId);
      else proximo.add(barbeariaId);
      queryClient.setQueryData(chave, proximo);
      return { anterior };
    },
    onError: (_erro, _id, ctx) => queryClient.setQueryData(chave, ctx?.anterior),
    onSettled: () => queryClient.invalidateQueries({ queryKey: chave }),
  });

  return { favoritas, alternar: alternar.mutate, logado: !!user };
}
