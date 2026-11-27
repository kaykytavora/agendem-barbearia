import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, CheckCircle2, Clock, Loader2, MessageCircle, Share2, TriangleAlert } from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn, formatBRL, whatsAppUrl } from "@/lib/utils";
import { formatarHora, horaNoDia, intervalosLivres, type Ocupacao } from "@/lib/agenda";
import { PausaControl } from "@/components/dashboard/PausaControl";
import { gerenciarAgendamento } from "@/integrations/supabase/api";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { ResgatesSelosEquipe } from "@/components/dashboard/ResgatesSelosEquipe";

interface AgendamentoDoDia {
  id: string;
  data_hora: string;
  status: "pendente" | "confirmado" | "cancelado" | "finalizado";
  cancelamento_solicitado_por: "cliente" | "equipe" | null;
  cliente_nome: string;
  cliente_telefone: string;
  servicos: { nome: string; valor: number; duracao_minutos: number } | null;
  funcionarios: { nome: string } | null;
}

interface Atendimento extends AgendamentoDoDia {
  inicio: Date;
  fim: Date;
}

const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const linkPedidosCancelamento = "/dashboard/agendamentos?status=pedido_cancelamento";

async function carregarInicio(userId: string, somenteDoFuncionario: boolean) {
  const { data: barbeariaId, error: rpcError } = await supabase.rpc("get_user_barbearia_id", { user_uuid: userId });
  if (rpcError) throw rpcError;
  if (!barbeariaId) throw new Error("Usuário não associado a uma barbearia.");

  const hoje = inicioDoDia(new Date());
  const amanha = new Date(hoje);
  amanha.setDate(hoje.getDate() + 1);

  let funcionarioId: string | null = null;
  if (somenteDoFuncionario) {
    const { data } = await supabase.from("funcionarios").select("id")
      .eq("barbearia_id", barbeariaId).eq("user_id", userId).maybeSingle();
    funcionarioId = data?.id ?? null;
  }

  let consulta = supabase
    .from("agendamentos")
    .select("id, data_hora, status, cancelamento_solicitado_por, cliente_nome, cliente_telefone, servicos(nome, valor, duracao_minutos), funcionarios(nome)")
    .eq("barbearia_id", barbeariaId)
    .gte("data_hora", hoje.toISOString())
    .lt("data_hora", amanha.toISOString())
    .order("data_hora");
  if (funcionarioId) consulta = consulta.eq("funcionario_id", funcionarioId);

  // Resumo do mês: só os agendamentos deste mês (o Dashboard antigo baixava o histórico inteiro)
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const inicioProximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  let consultaMes = supabase
    .from("agendamentos")
    .select("status, servicos(nome, valor)")
    .eq("barbearia_id", barbeariaId)
    .neq("status", "cancelado")
    .gte("data_hora", inicioMes.toISOString())
    .lt("data_hora", inicioProximoMes.toISOString());
  if (funcionarioId) consultaMes = consultaMes.eq("funcionario_id", funcionarioId);

  let consultaCancelamentos = supabase
    .from("agendamentos")
    .select("id", { count: "exact", head: true })
    .eq("barbearia_id", barbeariaId)
    .eq("cancelamento_solicitado_por", "cliente")
    .in("status", ["pendente", "confirmado"]);
  if (funcionarioId) {
    consultaCancelamentos = consultaCancelamentos.or(`funcionario_id.eq.${funcionarioId},funcionario_id.is.null`);
  }

  const [{ data: agendamentos, error }, { data: horario }, { data: doMes, error: erroMes }, pedidos] = await Promise.all([
    consulta,
    supabase
      .from("horarios_funcionamento")
      .select("fechado, hora_abre, hora_fecha")
      .eq("barbearia_id", barbeariaId)
      .eq("dia_semana", hoje.getDay())
      .maybeSingle(),
    consultaMes,
    somenteDoFuncionario && !funcionarioId ? Promise.resolve({ count: 0, error: null }) : consultaCancelamentos,
  ]);
  if (error) throw error;
  if (erroMes) throw erroMes;

  return {
    agendamentos: (agendamentos ?? []) as unknown as AgendamentoDoDia[],
    horario,
    mes: resumirMes((doMes ?? []) as unknown as AgendamentoDoMes[]),
    pedidosCancelamento: pedidos.error ? null : pedidos.count,
  };
}

interface AgendamentoDoMes {
  status: AgendamentoDoDia["status"];
  servicos: { nome: string; valor: number } | null;
}

/** Receita (só atendimentos finalizados) e serviço mais pedido do mês. */
function resumirMes(agendamentos: AgendamentoDoMes[]) {
  const receita = agendamentos
    .filter((a) => a.status === "finalizado")
    .reduce((total, a) => total + (a.servicos?.valor ?? 0), 0);

  const contagem = new Map<string, number>();
  for (const a of agendamentos) {
    if (a.servicos) contagem.set(a.servicos.nome, (contagem.get(a.servicos.nome) ?? 0) + 1);
  }
  const [maisPedido] = [...contagem.entries()].sort((a, b) => b[1] - a[1]);

  return {
    receita,
    atendimentos: agendamentos.filter((a) => a.status === "finalizado").length,
    total: agendamentos.length,
    maisPedido: maisPedido ? { nome: maisPedido[0], vezes: maisPedido[1] } : null,
  };
}

/** Atualiza o "agora" a cada minuto para "em 15 min" e o andamento da agenda. */
function useAgora() {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return agora;
}

const saudacao = (d: Date) => (d.getHours() < 12 ? "Bom dia" : d.getHours() < 18 ? "Boa tarde" : "Boa noite");

const duracaoTexto = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h${m ? String(m).padStart(2, "0") : ""}` : `${m} min`;
};

/** Tela inicial do painel: o dia (próximo cliente, números, agenda), a pausa e o resumo do mês. */
export default function Inicio() {
  const { user, role, profile, barbeariaId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const agora = useAgora();
  const somenteDoFuncionario = role === "funcionario";

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["inicio", user?.id, barbeariaId, somenteDoFuncionario],
    queryFn: () => carregarInicio(user!.id, somenteDoFuncionario),
    enabled: !!user && (role === "admin" || somenteDoFuncionario),
    refetchInterval: 2 * 60_000,
  });

  useRealtimeSubscription({
    channelName: "inicio-agendamentos",
    table: "agendamentos",
    filter: `barbearia_id=eq.${barbeariaId}`,
    event: "UPDATE",
    enabled: !!barbeariaId,
    onUpdate: () => { void queryClient.invalidateQueries({ queryKey: ["inicio", user?.id, barbeariaId] }); },
  });

  const finalizar = useMutation({
    mutationFn: (id: string) => gerenciarAgendamento(id, "finalizar"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inicio"] });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      void queryClient.invalidateQueries({ queryKey: ["agendamentos-agenda"] });
      toast({ title: "Atendimento finalizado" });
    },
    onError: (error) => {
      toast({ title: "Não foi possível finalizar", description: (error as Error).message, variant: "destructive" });
    },
  });

  const dia = useMemo(() => {
    const atendimentos: Atendimento[] = (data?.agendamentos ?? [])
      .filter((a) => a.status !== "cancelado")
      .map((a) => {
        const inicio = new Date(a.data_hora);
        return { ...a, inicio, fim: new Date(inicio.getTime() + (a.servicos?.duracao_minutos ?? 30) * 60_000) };
      });

    const finalizados = atendimentos.filter((a) => a.status === "finalizado");
    const proximo = atendimentos.find((a) => a.status !== "finalizado" && a.fim > agora) ?? null;

    const horario = data?.horario;
    const aberto = !!horario && !horario.fechado && !!horario.hora_abre && !!horario.hora_fecha;
    const livres: Ocupacao[] = aberto
      ? intervalosLivres({
          abre: horaNoDia(agora, horario.hora_abre!),
          fecha: horaNoDia(agora, horario.hora_fecha!),
          ocupados: atendimentos,
          desde: agora,
        })
      : [];
    const minutosLivres = livres.reduce((total, l) => total + (l.fim.getTime() - l.inicio.getTime()) / 60_000, 0);
    const encerrado = aberto && agora >= horaNoDia(agora, horario.hora_fecha!);

    // Agenda do dia: atendimentos e intervalos livres em ordem de horário
    const linhas = [
      ...atendimentos.map((a) => ({ tipo: "agendamento" as const, inicio: a.inicio, item: a })),
      ...livres.map((l) => ({ tipo: "livre" as const, inicio: l.inicio, item: l })),
    ].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

    return {
      atendimentos,
      finalizados,
      proximo,
      aberto,
      encerrado,
      livres,
      minutosLivres,
      linhas,
      previsto: atendimentos.reduce((t, a) => t + (a.servicos?.valor ?? 0), 0),
      recebido: finalizados.reduce((t, a) => t + (a.servicos?.valor ?? 0), 0),
    };
  }, [data, agora]);

  const primeiroNome = profile?.name?.split(" ")[0];
  const pedidosCancelamento = data?.pedidosCancelamento ?? 0;
  const minutosParaProximo = dia.proximo ? Math.round((dia.proximo.inicio.getTime() - agora.getTime()) / 60_000) : 0;
  const proximoRotulo = !dia.proximo
    ? ""
    : minutosParaProximo <= 0
      ? "Em atendimento"
      : minutosParaProximo < 60
        ? `Próximo cliente · em ${minutosParaProximo} min`
        : `Próximo cliente · às ${formatarHora(dia.proximo.inicio)}`;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 sm:p-6 md:pb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-muted-foreground first-letter:uppercase">
              {agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="text-3xl font-extrabold sm:text-4xl">
              {saudacao(agora)}{primeiroNome ? `, ${primeiroNome}` : ""}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {pedidosCancelamento === 0 && (
              <Button asChild size="lg" variant="outline">
                <Link to={linkPedidosCancelamento}>Pedidos de cancelamento</Link>
              </Button>
            )}
            <PausaControl />
            <Button asChild size="lg">
              <Link to="/dashboard/new-appointment">
                <CalendarPlus />
                Novo agendamento
              </Link>
            </Button>
          </div>
        </div>

        {pedidosCancelamento > 0 && (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-4 sm:px-5">
            <div className="flex items-start gap-3">
              <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
              <div>
                <h2 className="font-semibold" aria-live="polite">
                  {pedidosCancelamento === 1
                    ? "1 pedido de cancelamento aguardando resposta"
                    : `${pedidosCancelamento} pedidos de cancelamento aguardando resposta`}
                </h2>
                <p className="text-sm text-muted-foreground">Os horários continuam reservados até a equipe decidir.</p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to={linkPedidosCancelamento}>{pedidosCancelamento === 1 ? "Revisar pedido" : "Revisar pedidos"}</Link>
            </Button>
          </section>
        )}

        {barbeariaId && user && <ResgatesSelosEquipe barbeariaId={barbeariaId} userId={user.id} />}

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando o dia...
          </div>
        ) : isError ? (
          <div className="rounded-3xl border bg-card p-8 text-center">
            <p className="font-semibold">Não foi possível carregar a agenda de hoje.</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>Tentar novamente</Button>
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              {/* Próximo cliente */}
              {dia.proximo ? (
                <section aria-labelledby="proximo-titulo" className="flex flex-col gap-3 rounded-3xl bg-primary p-6 text-primary-foreground">
                  <h2 id="proximo-titulo" className="font-sans text-sm font-semibold text-primary-foreground/85">{proximoRotulo}</h2>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-display text-5xl font-extrabold leading-none">{formatarHora(dia.proximo.inicio)}</span>
                    <span className="text-xl font-bold">{dia.proximo.cliente_nome}</span>
                  </div>
                  <p className="text-primary-foreground/85">
                    {[dia.proximo.servicos?.nome, dia.proximo.servicos && `${dia.proximo.servicos.duracao_minutos} min`, dia.proximo.funcionarios?.nome && `com ${dia.proximo.funcionarios.nome}`, dia.proximo.servicos && formatBRL(dia.proximo.servicos.valor)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {dia.proximo.status === "confirmado" && !dia.proximo.cancelamento_solicitado_por ? <Button
                      className="bg-primary-foreground text-foreground hover:bg-primary-foreground/90"
                      onClick={() => finalizar.mutate(dia.proximo!.id)}
                      disabled={finalizar.isPending}
                    >
                      {finalizar.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                      Finalizar atendimento
                    </Button> : (
                      <Button asChild className="bg-primary-foreground text-foreground hover:bg-primary-foreground/90">
                        <Link to={`/dashboard/agendamentos?highlight=${dia.proximo.id}`}>
                          {dia.proximo.cancelamento_solicitado_por ? "Ver pedido de cancelamento" : "Ver confirmação"}
                        </Link>
                      </Button>
                    )}
                    {dia.proximo.cliente_telefone && (
                      <Button asChild variant="outline" className="border-primary-foreground/50 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                        <a href={whatsAppUrl(dia.proximo.cliente_telefone)} target="_blank" rel="noopener noreferrer">
                          <MessageCircle />
                          WhatsApp
                        </a>
                      </Button>
                    )}
                  </div>
                </section>
              ) : (
                <section className="flex flex-col justify-center gap-2 rounded-3xl border border-dashed border-input bg-card p-6">
                  <h2 className="text-xl font-bold">Nenhum próximo cliente hoje</h2>
                  <p className="text-sm text-muted-foreground">
                    {!dia.aberto
                      ? "A barbearia não abre hoje."
                      : dia.encerrado
                        ? "O expediente de hoje já terminou."
                        : "Divulgue seu link para preencher os horários livres."}
                  </p>
                  {role === "admin" && (
                    <Button asChild variant="outline" className="mt-2 w-fit">
                      <Link to="/dashboard/share-profile"><Share2 /> Compartilhar link de agendamento</Link>
                    </Button>
                  )}
                </section>
              )}

              {/* Números do dia */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-3xl border bg-card p-5">
                  <p className="text-sm text-muted-foreground">Agendamentos</p>
                  <p className="font-display text-3xl font-extrabold">{dia.atendimentos.length}</p>
                  <p className="text-sm text-muted-foreground">{dia.finalizados.length} atendidos</p>
                </div>
                <div className="rounded-3xl border bg-card p-5">
                  <p className="text-sm text-muted-foreground">Tempo livre</p>
                  <p className="font-display text-3xl font-extrabold">{dia.aberto && !dia.encerrado ? duracaoTexto(dia.minutosLivres) : "—"}</p>
                  <p className="text-sm text-muted-foreground">
                    {!dia.aberto
                      ? "fechado hoje"
                      : dia.encerrado
                        ? "expediente encerrado"
                        : dia.livres[0]
                          ? `a partir das ${formatarHora(dia.livres[0].inicio)}`
                          : "agenda cheia"}
                  </p>
                </div>
                <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-3xl bg-accent p-5">
                  <div>
                    <p className="text-sm text-accent-foreground">Previsto para hoje</p>
                    <p className="font-display text-3xl font-extrabold">{formatBRL(dia.previsto)}</p>
                  </div>
                  <p className="text-sm font-semibold text-accent-foreground">{formatBRL(dia.recebido)} recebidos</p>
                </div>
              </div>
            </div>

            {/* Este mês */}
            {data?.mes && (
              <section aria-labelledby="mes-titulo" className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-3xl border bg-card px-5 py-4">
                <h2 id="mes-titulo" className="w-full text-sm font-semibold text-muted-foreground sm:w-auto">
                  {somenteDoFuncionario ? "Seu mês" : "Este mês"}
                </h2>
                <div>
                  <p className="font-display text-xl font-extrabold">{formatBRL(data.mes.receita)}</p>
                  <p className="text-xs text-muted-foreground">
                    recebidos em {data.mes.atendimentos} {data.mes.atendimentos === 1 ? "atendimento" : "atendimentos"}
                  </p>
                </div>
                <div>
                  <p className="font-display text-xl font-extrabold">{data.mes.total}</p>
                  <p className="text-xs text-muted-foreground">agendamentos no mês</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display text-xl font-extrabold">{data.mes.maisPedido?.nome ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {data.mes.maisPedido ? `serviço mais pedido · ${data.mes.maisPedido.vezes}×` : "nenhum agendamento ainda"}
                  </p>
                </div>
              </section>
            )}

            {/* Agenda do dia */}
            <section aria-labelledby="agenda-titulo" className="rounded-3xl border bg-card p-4 sm:p-6">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 id="agenda-titulo" className="text-xl font-bold">Agenda do dia</h2>
                <Link to="/dashboard/agenda" className="text-sm font-semibold text-primary hover:underline">Ver agenda completa</Link>
              </div>

              {dia.linhas.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {dia.aberto ? "Nenhum agendamento hoje." : "A barbearia está fechada hoje."}
                </p>
              ) : (
                <ul className="space-y-1">
                  {dia.linhas.map((linha) => {
                    if (linha.tipo === "livre") {
                      const livre = linha.item;
                      return (
                        <li key={`livre-${livre.inicio.getTime()}`} className="flex items-center gap-4 rounded-2xl border border-dashed border-input px-3 py-3">
                          <span className="w-12 shrink-0 font-semibold text-muted-foreground">{formatarHora(livre.inicio)}</span>
                          <span className="flex-1 text-muted-foreground">Livre até {formatarHora(livre.fim)}</span>
                          <Link to="/dashboard/new-appointment" className="text-sm font-semibold text-primary hover:underline">Encaixar cliente</Link>
                        </li>
                      );
                    }

                    const a = linha.item;
                    const feito = a.status === "finalizado";
                    const atual = a.id === dia.proximo?.id;
                    return (
                      <li
                        key={a.id}
                        className={cn("flex items-center gap-4 rounded-2xl px-3 py-3", atual && "bg-accent", feito && "text-muted-foreground")}
                      >
                        <span className={cn("w-12 shrink-0 font-semibold", atual && "text-accent-foreground")}>{formatarHora(a.inicio)}</span>
                        <span className={cn("min-w-0 flex-1 truncate", atual && "font-semibold", feito && "line-through")}>
                          {a.cliente_nome}{a.servicos ? ` · ${a.servicos.nome}` : ""}
                        </span>
                        <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">{a.funcionarios?.nome}</span>
                        {feito ? (
                          <span className="shrink-0 text-sm">Atendido</span>
                        ) : a.status === "pendente" ? (
                          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">Pendente</span>
                        ) : (
                          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Confirmado" />
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
