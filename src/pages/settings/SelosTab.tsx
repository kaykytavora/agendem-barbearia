import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

function FormularioSelos({ barbeariaId, programa, servicos }: {
  barbeariaId: string;
  programa: Tables<"programas_selos"> | null;
  servicos: { id: string; nome: string }[];
}) {
  const [ativo, setAtivo] = useState(programa?.ativo ?? false);
  const [premio, setPremio] = useState(programa?.premio ?? "");
  const [meta, setMeta] = useState(programa ? String(programa.meta) : "");
  const [selecionados, setSelecionados] = useState(programa?.servicos ?? []);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const metaNumerica = Number(meta);
      const ids = servicos.filter(({ id }) => selecionados.includes(id)).map(({ id }) => id);
      if (ativo && (!premio.trim() || !Number.isInteger(metaNumerica) || metaNumerica < 1 || !ids.length)) {
        throw new Error("Informe o prêmio, a quantidade de selos e selecione pelo menos um serviço.");
      }
      const { error } = await supabase.rpc("salvar_programa_selos", {
        p_barbearia: barbeariaId, p_ativo: ativo, p_premio: premio.trim(), p_meta: ativo ? metaNumerica : 1, p_servicos: ids,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["configuracao-selos", barbeariaId] });
      void queryClient.invalidateQueries({ queryKey: ["programa-selos", barbeariaId] });
      toast({ title: ativo ? "Programa de selos ativado." : "Programa de selos pausado." });
    },
    onError: (error) => toast({ title: "Não foi possível salvar o programa", description: error.message, variant: "destructive" }),
  });

  function salvar(event: FormEvent) {
    event.preventDefault();
    if (!isPending) mutate();
  }

  return (
    <form onSubmit={salvar} className="space-y-5">
      <fieldset disabled={isPending} className="space-y-5">
        <div className="flex items-start justify-between gap-4 rounded-xl border p-4">
          <div>
            <Label htmlFor="selos-ativo">Ativar programa de selos</Label>
            <p className="text-sm text-muted-foreground">Cada atendimento finalizado em um serviço participante vale um selo. Ao pausar, os clientes mantêm o saldo.</p>
          </div>
          <Switch id="selos-ativo" checked={ativo} onCheckedChange={setAtivo} />
        </div>
        {ativo && (
          <>
            <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
              <div className="space-y-2">
                <Label htmlFor="selos-premio">Prêmio</Label>
                <Input id="selos-premio" placeholder="Ex.: Um corte grátis" maxLength={120} required value={premio}
                  onChange={(event) => setPremio(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="selos-meta">Selos para resgatar</Label>
                <Input id="selos-meta" type="number" min={1} step={1} max={2147483647} required value={meta}
                  onChange={(event) => setMeta(event.target.value)} />
              </div>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Serviços que dão selo</legend>
              <p className="text-sm text-muted-foreground">
                Marque cada serviço participante, incluindo os combos. Por exemplo, marque Corte e Corte + Sobrancelha se os dois devem dar selo.
              </p>
              {servicos.length === 0 && <p className="text-sm text-muted-foreground">Cadastre um serviço para ativar o programa.</p>}
              {servicos.map((servico) => (
                <Label key={servico.id} className="flex cursor-pointer items-center gap-2 font-normal">
                  <Checkbox checked={selecionados.includes(servico.id)} onCheckedChange={(checked) => {
                    setSelecionados((lista) => checked === true ? [...lista, servico.id] : lista.filter((id) => id !== servico.id));
                  }} />
                  {servico.nome}
                </Label>
              ))}
            </fieldset>
          </>
        )}
      </fieldset>
      <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : "Salvar programa"}</Button>
    </form>
  );
}

export function SelosTab({ barbeariaId }: { barbeariaId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["configuracao-selos", barbeariaId],
    queryFn: async () => {
      const [programa, servicos] = await Promise.all([
        supabase.from("programas_selos").select("*").eq("barbearia_id", barbeariaId).maybeSingle(),
        supabase.from("servicos").select("id, nome").eq("barbearia_id", barbeariaId).order("nome"),
      ]);
      if (programa.error || servicos.error) throw programa.error ?? servicos.error;
      return { programa: programa.data, servicos: servicos.data ?? [] };
    },
  });

  return (
    <TabsContent value="selos">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /> Programa de selos</CardTitle></CardHeader>
        <CardContent>
          {isLoading && <p role="status">Carregando programa...</p>}
          {isError && <Button variant="outline" onClick={() => void refetch()}>Tentar carregar novamente</Button>}
          {data && <FormularioSelos key={barbeariaId} barbeariaId={barbeariaId} {...data} />}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
