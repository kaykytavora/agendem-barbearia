import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Cartao = Database["public"]["Functions"]["meus_cartoes_selos"]["Returns"][number];

function CartaoSelos({ cartao, userId }: { cartao: Cartao; userId: string }) {
  const queryClient = useQueryClient();
  const tentativa = useRef<string | null>(null);
  const { toast } = useToast();
  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      tentativa.current ??= crypto.randomUUID();
      const { error } = await supabase.rpc("resgatar_premio_selos", {
        p_barbearia: cartao.barbearia_id, p_resgate: tentativa.current, p_premio: cartao.premio, p_meta: cartao.meta,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      tentativa.current = null;
      toast({ title: "Prêmio resgatado. Mostre o resgate à barbearia." });
    },
    onError: (error) => toast({ title: "Não foi possível resgatar", description: error.message, variant: "destructive" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["cartoes-selos", userId] }),
  });
  const faltam = Math.max(0, cartao.meta - cartao.saldo);

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold">{cartao.nome}</h3>
        <p className="shrink-0 text-sm tabular-nums">{cartao.saldo} de {cartao.meta} {cartao.meta === 1 ? "selo" : "selos"}</p>
      </div>
      <Progress aria-label={`Progresso do cartão de selos de ${cartao.nome}`} value={Math.min(100, 100 * cartao.saldo / cartao.meta)} />
      <p className="text-sm">Prêmio: {cartao.premio}</p>
      <div className="flex flex-wrap items-center gap-2">
        {!cartao.ativo ? <p className="text-sm text-muted-foreground">Programa pausado pela barbearia.</p> : faltam > 0 ? (
          <p className="text-sm text-muted-foreground">{faltam === 1 ? "Falta 1 selo" : `Faltam ${faltam} selos`} para resgatar.</p>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild><Button size="sm" disabled={isPending}>Resgatar prêmio</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Resgatar {cartao.premio}?</AlertDialogTitle>
                <AlertDialogDescription>O resgate usa {cartao.meta} {cartao.meta === 1 ? "selo" : "selos"} do cartão de {cartao.nome}.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction onClick={() => mutate()}>Confirmar resgate</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {cartao.ativo && cartao.slug && <Button asChild size="sm" variant="link"><Link to={`/barbearia/${cartao.slug}`}>Ver horários</Link></Button>}
      </div>
    </div>
  );
}

export function CartoesSelos({ userId }: { userId: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["cartoes-selos", userId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const [cartoes, resgates] = await Promise.all([supabase.rpc("meus_cartoes_selos"), supabase.rpc("listar_resgates_selos")]);
      if (cartoes.error || resgates.error) throw cartoes.error ?? resgates.error;
      return { cartoes: cartoes.data ?? [], resgates: resgates.data ?? [] };
    },
  });
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader><CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /> Meus selos</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {isError && <Button size="sm" variant="outline" onClick={() => void refetch()}>Tentar carregar os selos novamente</Button>}
        {isLoading && <p role="status" className="text-sm text-muted-foreground">Carregando seus selos...</p>}
        {data && !data.cartoes.length && (
          <p className="text-sm text-muted-foreground">Seus selos aparecem aqui após um atendimento em uma barbearia participante.</p>
        )}
        {data?.cartoes.map((cartao) => <CartaoSelos key={cartao.barbearia_id} cartao={cartao} userId={userId} />)}
        {!!data?.resgates.length && (
          <div className="space-y-2">
            <h3 className="font-semibold">Prêmios resgatados</h3>
            {data.resgates.map((resgate) => (
              <div key={resgate.id} className="flex flex-wrap justify-between gap-2 rounded-xl border p-3 text-sm">
                <p>{resgate.premio} <span className="text-muted-foreground">· {resgate.barbearia}</span></p>
                <span className="text-muted-foreground">{resgate.entregue_em ? "Entregue" : "Aguardando entrega"}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
