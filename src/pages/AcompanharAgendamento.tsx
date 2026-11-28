import { Link, useLocation, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Copy, Gift, Loader2, Scissors, User } from "lucide-react";
import { AgendemIcon } from "@/components/AgendemIcon";
import { AcoesAgendamento } from "@/components/AcoesAgendamento";
import { Button } from "@/components/ui/button";
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

const corStatus = {
  pendente: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  confirmado: "bg-primary/10 text-primary",
  cancelado: "bg-destructive/10 text-destructive",
  finalizado: "bg-muted text-muted-foreground",
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

  const dataHora = data ? new Date(data.data_hora) : null;

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-gradient-bg px-4 py-8">
      <Link to="/barbearias" className="mb-5 flex items-center gap-2 text-primary">
        <AgendemIcon className="h-6 w-6" />
        <span className="font-display text-lg font-bold text-foreground">agendem<span className="text-primary">.</span></span>
      </Link>

      <section className="page-enter w-full max-w-md overflow-hidden rounded-3xl border border-border/60 bg-card shadow-brand-lg">
        <header className="flex items-center gap-2 border-b border-border/60 px-5 py-4">
          <Calendar className="h-4 w-4 text-primary" aria-hidden="true" />
          <h1 className="text-base font-semibold">Acompanhar agendamento</h1>
        </header>

        <div className="space-y-5 p-5">
          {isLoading ? (
            <p role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando agendamento...
            </p>
          ) : isError ? (
            <div className="space-y-3 py-4 text-center">
              <p>Não consegui consultar o agendamento agora.</p>
              <Button variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>
            </div>
          ) : data && dataHora ? (
            <>
              <div className="flex flex-col items-center text-center">
                <div className="mb-3 flex h-20 w-20 flex-col items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-brand-md">
                  <span className="text-xs font-medium uppercase opacity-80">
                    {dataHora.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                  </span>
                  <span className="font-display text-3xl font-bold leading-none">{dataHora.getDate()}</span>
                </div>
                <p className="text-lg font-bold">{data.barbearia}</p>
                <p className="text-sm text-muted-foreground first-letter:uppercase">
                  {dataHora.toLocaleDateString("pt-BR", { weekday: "long" })} às {dataHora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
                <span role="status" className={`mt-3 rounded-full px-3 py-1 text-xs font-semibold ${corStatus[data.status]}`}>
                  {statusLabel[data.status]}
                </span>
              </div>

              <dl className="space-y-2 rounded-2xl bg-muted/50 p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground"><Scissors className="h-3.5 w-3.5" aria-hidden="true" /> Serviço</dt>
                  <dd className="text-right font-medium">{data.servico}</dd>
                </div>
                {data.profissional && (
                  <div className="flex justify-between gap-3">
                    <dt className="flex items-center gap-1.5 text-muted-foreground"><User className="h-3.5 w-3.5" aria-hidden="true" /> Profissional</dt>
                    <dd className="text-right font-medium">{data.profissional}</dd>
                  </div>
                )}
              </dl>

              <div className="flex flex-col items-center text-center [&_.flex-wrap]:justify-center">
                <AcoesAgendamento agendamento={data} lado="cliente" token={token} onAtualizar={() => void refetch()} />
              </div>

              {data.status === "finalizado" && data.selo_disponivel && (
                <div className="space-y-2 rounded-2xl border border-primary/25 bg-primary/5 p-4 text-center">
                  <p className="flex items-center justify-center gap-2 text-sm font-medium"><Gift className="h-4 w-4 text-primary" aria-hidden="true" /> Este atendimento vale um selo.</p>
                  {role === "cliente" ? (
                    <Button size="sm" disabled={guardarSelo.isPending} onClick={() => guardarSelo.mutate()}>Guardar selo</Button>
                  ) : !user && (
                    <Button asChild size="sm">
                      <Link to="/client-login" state={{ voltarAoAgendamento: `/acompanhar-agendamento/${id}${hash}` }}>Entrar para guardar o selo</Link>
                    </Button>
                  )}
                </div>
              )}
              {guardarSelo.isSuccess && <Button asChild size="sm" variant="outline" className="w-full"><Link to="/client-panel">Ver meus selos</Link></Button>}
              <Button variant="outline" className="w-full" onClick={copiarLink}><Copy /> Guardar link de acompanhamento</Button>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Este link é inválido ou foi substituído. Peça um novo link à barbearia.</p>
          )}
        </div>
      </section>

      <Button asChild variant="link" className="mt-3"><Link to="/barbearias">Ver barbearias</Link></Button>
    </main>
  );
}
