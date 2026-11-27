import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function ResgatesSelosEquipe({ barbeariaId, userId }: { barbeariaId: string; userId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ["resgates-selos-equipe", barbeariaId, userId];
  const { data } = useQuery({
    queryKey,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_resgates_selos", { p_barbearia: barbeariaId });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { mutate, isPending } = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("entregar_premio_selos", { p_resgate: id });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
      toast({ title: "Entrega registrada." });
    },
    onError: (error) => toast({ title: "Não foi possível registrar a entrega", description: error.message, variant: "destructive" }),
  });

  if (!data?.length) return null;
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-semibold"><Gift className="h-5 w-5 text-primary" /> Prêmios aguardando entrega</h2>
      {data.map((resgate) => (
        <div key={resgate.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
          <div>
            <p className="text-sm font-medium">{resgate.cliente}</p>
            <p className="text-sm text-muted-foreground">{resgate.premio}</p>
          </div>
          <Button variant="outline" size="sm" disabled={isPending} onClick={() => mutate(resgate.id)}>Marcar como entregue</Button>
        </div>
      ))}
    </section>
  );
}
