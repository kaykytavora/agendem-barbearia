import { Link, useLocation, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Copy, Gift } from "lucide-react";
import { AcoesAgendamento } from "@/components/AcoesAgendamento";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { consultarAgendamentoPorLink } from "@/integrations/supabase/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const statusLabel = {
  pendente: "Aguardando confirmação",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
  finalizado: "Finalizado",
};

export default function AcompanharAgendamento() {
  const { id = "" } = useParams();
  const { hash } = useLocation();
  const { toast } = useToast();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const token = hash.slice(1);
  const linkValido = /^[0-9a-f-]{36}$/i.test(id) && /^[0-9a-f]{128}$/.test(token);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["acompanhar-agendamento", id, token],
    queryFn: () => consultarAgendamentoPorLink(id, token),
    enabled: linkValido,
    refetchInterval: 15_000,
    retry: false,
  });
  const guardarSelo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("registrar_selo_do_link", { p_id: id, p_token: token });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ["cartoes-selos", user?.id] });
      toast({ title: "Selo guardado no seu cartão." });
    },
    onError: (error) => toast({ title: "Não foi possível guardar o selo", description: error.message, variant: "destructive" }),
  });

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copiado" });
    } catch {
      toast({ title: "Copie o endereço pela barra do navegador." });
    }
  }

  return (
    <main className="min-h-screen bg-gradient-bg px-4 py-10 sm:py-16">
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Acompanhar agendamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? <p role="status">Carregando agendamento...</p> : isError ? (
            <div className="space-y-2">
              <p>Não consegui consultar o agendamento agora.</p>
              <Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>
            </div>
          ) : data ? (
            <>
              <div>
                <p className="font-semibold">{data.barbearia}</p>
                <p>{data.servico}{data.profissional && ` com ${data.profissional}`}</p>
                <p className="text-muted-foreground">
                  {new Date(data.data_hora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
              <p className="font-medium" role="status">{statusLabel[data.status]}</p>
              <AcoesAgendamento agendamento={data} lado="cliente" token={token} onAtualizar={() => void refetch()} />
              {data.status === "finalizado" && data.selo_disponivel && (
                <div className="space-y-2 rounded-xl border p-4">
                  <p className="flex items-center gap-2 text-sm font-medium"><Gift className="h-4 w-4 text-primary" /> Este atendimento vale um selo.</p>
                  {role === "cliente" ? (
                    <Button size="sm" disabled={guardarSelo.isPending} onClick={() => guardarSelo.mutate()}>Guardar selo</Button>
                  ) : !user && (
                    <Button asChild size="sm">
                      <Link to="/client-login" state={{ voltarAoAgendamento: `/acompanhar-agendamento/${id}${hash}` }}>Entrar para guardar o selo</Link>
                    </Button>
                  )}
                </div>
              )}
              {guardarSelo.isSuccess && <Button asChild size="sm" variant="outline"><Link to="/client-panel">Ver meus selos</Link></Button>}
              <Button variant="outline" size="sm" onClick={copiarLink}><Copy /> Guardar link de acompanhamento</Button>
            </>
          ) : <p>Este link é inválido ou foi substituído. Peça um novo link à barbearia.</p>}
          <Button asChild variant="link" className="px-0"><Link to="/barbearias">Ver barbearias</Link></Button>
        </CardContent>
      </Card>
    </main>
  );
}
