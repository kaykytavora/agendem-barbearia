import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { estaAberto, resumirHorarios } from "@/lib/horarios";
import { dataLocalISO, type HorarioOcupado, type PausaProfissional } from "@/lib/agenda";

type Feedback = Database["public"]["Tables"]["feedbacks"]["Row"];
export type FeedbackWithProfile = Feedback & {
  profiles: { name: string | null; avatar_url: string | null } | null;
};

export interface BarbershopStats {
  totalFuncionarios: number;
  mediaAvaliacoes: number;
  totalAvaliacoes: number;
  isOpen: boolean;
  horarioFormatado: string;
  diasFormatado: string;
}

async function carregarBarbearia(slug: string) {
  const { data: barbearia, error } = await supabase
    .from("barbearias")
    .select("*, servicos (*), funcionarios (id, nome)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!barbearia) return null;

  // Horários já reservados de hoje até o fim da janela de agendamento (30 dias).
  // Vem de uma função porque visitantes e clientes não podem ler os agendamentos de outras pessoas.
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fimDaJanela = new Date(hoje);
  fimDaJanela.setDate(hoje.getDate() + 31);

  const [horarios, ausencias, ocupados, pausas, avaliacoes, ultimosFeedbacks] = await Promise.all([
    supabase.from("horarios_funcionamento").select("*").eq("barbearia_id", barbearia.id),
    supabase.from("funcionario_ausencias").select("*").eq("barbearia_id", barbearia.id),
    supabase.rpc("horarios_ocupados", {
      p_barbearia_id: barbearia.id,
      p_de: hoje.toISOString(),
      p_ate: fimDaJanela.toISOString(),
    }),
    // Pausas (almoço, intervalo) também bloqueiam horários; só as colunas de que a disponibilidade precisa
    supabase
      .from("funcionario_pausas")
      .select("funcionario_id, data, hora_inicio, hora_fim")
      .eq("barbearia_id", barbearia.id)
      .gte("data", dataLocalISO(hoje))
      .lte("data", dataLocalISO(fimDaJanela)),
    supabase.from("feedbacks").select("rating").eq("barbearia_id", barbearia.id).eq("status", "concluido").not("rating", "is", null),
    supabase
      .from("feedbacks")
      .select("*")
      .eq("barbearia_id", barbearia.id)
      .eq("status", "concluido")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  // Sem os horários ocupados não há como calcular disponibilidade: melhor falhar do que oferecer horários errados
  if (ocupados.error) throw ocupados.error;
  if (pausas.error) throw pausas.error;
  for (const res of [horarios, ausencias, avaliacoes, ultimosFeedbacks]) {
    if (res.error) console.error("Erro ao carregar dados da barbearia:", res.error);
  }

  const notas = (avaliacoes.data ?? []).map((a) => a.rating ?? 0);
  const resumo = resumirHorarios(horarios.data);
  const stats: BarbershopStats = {
    totalFuncionarios: barbearia.funcionarios?.length ?? 0,
    totalAvaliacoes: notas.length,
    mediaAvaliacoes: notas.length ? Math.round((notas.reduce((t, n) => t + n, 0) / notas.length) * 10) / 10 : 0,
    isOpen: estaAberto(horarios.data),
    horarioFormatado: resumo?.horas ?? "",
    diasFormatado: resumo?.dias ?? "",
  };

  return {
    // `any` mantido por enquanto: a página acessa os relacionamentos embutidos livremente
    barbershop: {
      ...barbearia,
      horarios_funcionamento: horarios.data ?? [],
      horarios_ocupados: (ocupados.data ?? []) as HorarioOcupado[],
      pausas: (pausas.data ?? []) as PausaProfissional[],
      funcionarios: barbearia.funcionarios ?? [],
    } as any,
    ausencias: ausencias.data ?? [],
    feedbacks: (ultimosFeedbacks.data ?? []) as unknown as FeedbackWithProfile[],
    stats,
  };
}

export function useBarbershopDetails(slug: string | undefined) {
  return useQuery({
    queryKey: ["barbershop", slug],
    queryFn: () => carregarBarbearia(slug!),
    enabled: !!slug && slug !== "null",
    // Evita recarregar tudo a cada vez que a aba volta ao foco; após um agendamento a página chama refetch()
    staleTime: 60_000,
  });
}
