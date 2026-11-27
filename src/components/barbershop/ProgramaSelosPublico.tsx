import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function ProgramaSelosPublico({ barbeariaId, servicos }: {
  barbeariaId: string;
  servicos: { id: string; nome: string }[];
}) {
  const { data } = useQuery({
    queryKey: ["programa-selos", barbeariaId],
    queryFn: async () => {
      const { data, error } = await supabase.from("programas_selos").select("premio, meta, servicos")
        .eq("barbearia_id", barbeariaId).eq("ativo", true).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (!data) return null;
  const participantes = servicos.filter((servico) => data.servicos.includes(servico.id));
  if (!participantes.length) return null;

  return (
    <section className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <Gift className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="space-y-1">
        <h2 className="font-semibold">Programa de selos</h2>
        <p className="text-sm">Junte {data.meta} {data.meta === 1 ? "selo" : "selos"} para resgatar {data.premio}.</p>
        <p className="text-sm text-muted-foreground">Ganhe um selo por atendimento finalizado nestes serviços: {participantes.map((s) => s.nome).join(", ")}.</p>
      </div>
    </section>
  );
}
