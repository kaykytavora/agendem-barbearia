import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronRight, PartyPopper, Rocket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { usePrimeirosPassos } from "@/hooks/usePrimeirosPassos";
import { cn } from "@/lib/utils";
import {
  concluir,
  etapasAdmin,
  ETAPAS_POR_VISITA,
  marcarEtapaVista,
  type DadosConfiguracao,
  type EtapaAdmin,
} from "@/lib/primeiros-passos";

async function buscarConfiguracao(barbeariaId: string): Promise<DadosConfiguracao> {
  const [barbearia, servicos, funcionarios] = await Promise.all([
    supabase.from("barbearias").select("endereco, cidade").eq("id", barbeariaId).single(),
    supabase.from("servicos").select("id", { count: "exact", head: true }).eq("barbearia_id", barbeariaId),
    supabase.from("funcionarios").select("id", { count: "exact", head: true }).eq("barbearia_id", barbeariaId),
  ]);
  if (barbearia.error) throw barbearia.error;
  const erro = servicos.error ?? funcionarios.error;
  if (erro) throw erro;

  return {
    endereco: barbearia.data.endereco,
    cidade: barbearia.data.cidade,
    totalServicos: servicos.count ?? 0,
    totalFuncionarios: funcionarios.count ?? 0,
  };
}

/**
 * Passo a passo de configuração para o dono da barbearia, no topo do dashboard.
 * Some quando ele conclui ou dispensa; o progresso fica salvo no perfil.
 */
export function ChecklistAdmin({ barbeariaId }: { barbeariaId: string }) {
  const { estado, salvar } = usePrimeirosPassos();
  const ativo = !!estado && !estado.concluido_em;

  const { data } = useQuery({
    queryKey: ["primeiros-passos-admin", barbeariaId],
    queryFn: () => buscarConfiguracao(barbeariaId),
    enabled: ativo,
    // Volta do cadastro de serviços com o item já marcado
    refetchOnMount: "always",
  });

  if (!ativo || !estado || !data) return null;

  const etapas = etapasAdmin(data, estado);
  const feitas = etapas.filter((e) => e.feito).length;
  const tudoPronto = feitas === etapas.length;

  const abrirEtapa = (etapa: EtapaAdmin) => {
    if (!etapa.feito && ETAPAS_POR_VISITA.has(etapa.id)) {
      void salvar(marcarEtapaVista(estado, etapa.id));
    }
  };

  return (
    <section aria-labelledby="primeiros-passos-titulo" className="rounded-3xl border border-primary/30 bg-card p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {tudoPronto ? <PartyPopper className="h-5 w-5" aria-hidden="true" /> : <Rocket className="h-5 w-5" aria-hidden="true" />}
          </span>
          <div>
            <h2 id="primeiros-passos-titulo" className="text-lg font-bold">
              {tudoPronto ? "Sua barbearia está pronta!" : "Primeiros passos"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tudoPronto
                ? "Agora é só aguardar os agendamentos chegarem."
                : "Siga as etapas para começar a receber agendamentos."}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label="Dispensar primeiros passos"
          onClick={() => void salvar(concluir(estado))}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Progress value={(feitas / etapas.length) * 100} className="h-2" aria-label="Progresso da configuração" />
        <span className="shrink-0 text-sm font-medium tabular-nums">
          {feitas}/{etapas.length}
        </span>
      </div>

      {tudoPronto ? (
        <Button className="mt-4 w-full sm:w-auto" onClick={() => void salvar(concluir(estado))}>
          Concluir
        </Button>
      ) : (
        <ol className="mt-4 space-y-2">
          {etapas.map((etapa) => (
            <li key={etapa.id}>
              <Link
                to={etapa.destino}
                onClick={() => abrirEtapa(etapa)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3 transition-colors hover:bg-muted/50 touch-target",
                  etapa.feito && "border-transparent bg-muted/30"
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                    etapa.feito ? "border-success bg-success text-white" : "border-muted-foreground/40"
                  )}
                  aria-hidden="true"
                >
                  {etapa.feito && <Check className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm font-medium", etapa.feito && "text-muted-foreground line-through")}>
                    {etapa.titulo}
                    <span className="sr-only">{etapa.feito ? ": concluído" : ": pendente"}</span>
                  </span>
                  {!etapa.feito && <span className="block text-xs text-muted-foreground">{etapa.descricao}</span>}
                </span>
                {!etapa.feito && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
