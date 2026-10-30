import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { HorarioDia } from "@/lib/horarios";

export type BarbershopListItem = Database["public"]["Tables"]["barbearias"]["Row"] & {
  servicos: { categoria_id: string | null; categoria_id_2?: string | null }[]; // IDs das categorias para filtro
  horarios_funcionamento: HorarioDia[];
  slug: string;
  rating: number;
};

export type Category = Pick<Database["public"]["Tables"]["categorias_servicos"]["Row"], "id" | "nome">;

async function carregarBarbearias() {
  const [barbeariasRes, categoriasRes] = await Promise.all([
    supabase.from("barbearias").select("*, servicos ( categoria_id, categoria_id_2 )"),
    supabase.from("categorias_servicos").select("id, nome").order("nome"),
  ]);
  if (barbeariasRes.error) throw barbeariasRes.error;
  if (categoriasRes.error) throw categoriasRes.error;

  const barbearias = barbeariasRes.data ?? [];
  const ids = barbearias.map((b) => b.id);

  // Avaliações e horários de todas as barbearias de uma vez (antes era uma consulta por barbearia).
  // horarios_funcionamento não tem FK para barbearias, então não dá para embutir no select acima.
  const [avaliacoesRes, horariosRes] = await Promise.all([
    supabase.from("feedbacks").select("barbearia_id, rating").in("barbearia_id", ids).eq("status", "concluido").not("rating", "is", null),
    supabase.from("horarios_funcionamento").select("barbearia_id, dia_semana, fechado, hora_abre, hora_fecha").in("barbearia_id", ids),
  ]);
  // Sem avaliações ou horários a listagem ainda funciona, então esses erros não derrubam a página
  if (avaliacoesRes.error) console.error("Erro ao buscar avaliações:", avaliacoesRes.error);
  if (horariosRes.error) console.error("Erro ao buscar horários:", horariosRes.error);

  const notas = new Map<string, number[]>();
  for (const a of avaliacoesRes.data ?? []) {
    if (a.rating == null) continue;
    notas.set(a.barbearia_id, [...(notas.get(a.barbearia_id) ?? []), a.rating]);
  }

  const lista = barbearias.map((b) => {
    const n = notas.get(b.id) ?? [];
    const media = n.length ? n.reduce((t, x) => t + x, 0) / n.length : 0;
    return {
      ...b,
      rating: Math.round(media * 10) / 10,
      horarios_funcionamento: (horariosRes.data ?? []).filter((h) => h.barbearia_id === b.id),
    };
  }) as unknown as BarbershopListItem[];

  return {
    barbearias: lista,
    categorias: (categoriasRes.data ?? []) as Category[],
    cidades: [...new Set(barbearias.map((b) => b.cidade).filter(Boolean) as string[])],
  };
}

export function useBarbershopsList() {
  return useQuery({
    queryKey: ["barbershops-list"],
    queryFn: carregarBarbearias,
    staleTime: 60_000,
  });
}
