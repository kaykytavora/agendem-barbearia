import { useQuery } from "@tanstack/react-query";
import { Gift, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

function useProgramaSelos(barbeariaId: string) {
  return useQuery({
    queryKey: ["programa-selos", barbeariaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("programas_selos").select("premio, meta, servicos")
        .eq("barbearia_id", barbeariaId).eq("ativo", true).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

const textoSemLogin = "Agendamentos sem login não acumulam selos. Os selos só valem para reservas feitas com sua conta conectada.";

export function ProgramaSelosPublico({ barbeariaId, servicos, semLogin = false, className }: {
  barbeariaId: string;
  servicos: { id: string; nome: string }[];
  /** Mostra o aviso de que reservas sem conta não acumulam selos */
  semLogin?: boolean;
  className?: string;
}) {
  const { data } = useProgramaSelos(barbeariaId);
  if (!data) return null;
  const participantes = servicos.filter((servico) => data.servicos.includes(servico.id));
  if (!participantes.length) return null;

  return (
    <section className={cn("flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4", className)}>
      <Gift className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="space-y-1">
        <h2 className="font-semibold">Programa de selos</h2>
        <p className="text-sm">Junte {data.meta} {data.meta === 1 ? "selo" : "selos"} para resgatar {data.premio}.</p>
        <p className="text-sm text-muted-foreground">Ganhe um selo por atendimento finalizado nestes serviços: {participantes.map((s) => s.nome).join(", ")}.</p>
        {semLogin && (
          <p className="flex items-start gap-1.5 pt-1 text-sm font-medium text-amber-700 dark:text-amber-400">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {textoSemLogin}
          </p>
        )}
      </div>
    </section>
  );
}

/** Aviso exibido na etapa de dados quando o cliente vai reservar sem estar logado */
export function AvisoSelosSemLogin({ barbeariaId }: { barbeariaId: string }) {
  const { data } = useProgramaSelos(barbeariaId);
  if (!data) return null;

  return (
    <div role="note" className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
      <div className="space-y-0.5 text-sm">
        <p className="font-semibold">Esta reserva não vai contar selos</p>
        <p className="text-muted-foreground">
          {textoSemLogin} Para ganhar seu {data.premio}, entre na sua conta antes de agendar.
        </p>
      </div>
    </div>
  );
}
