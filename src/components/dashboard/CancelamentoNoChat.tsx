import { useQuery } from "@tanstack/react-query";
import { AcoesAgendamento } from "@/components/AcoesAgendamento";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { dataLocalISO, formatarHora } from "@/lib/agenda";
import { dataValida, horaValida, normalizarNome, type PedidoCancelamentoChat } from "@/lib/agendamento-assistido";

const maxResultados = 5;
const tamanhoPagina = 100;

async function buscarAgendamentos(userId: string, barbeariaId: string, admin: boolean, pedido: PedidoCancelamentoChat) {
  let funcionarioId: string | null = null;
  if (!admin) {
    const { data, error } = await supabase.from("funcionarios").select("id")
      .eq("barbearia_id", barbeariaId).eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!data) return [];
    funcionarioId = data.id;
  }

  const dia = pedido.data ?? dataLocalISO(new Date());
  const inicio = new Date(`${dia}T00:00:00`);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 1);
  const cliente = normalizarNome(pedido.cliente ?? "");

  const buscarPagina = (offset: number) => {
    let consulta = supabase.from("agendamentos")
      .select("id, cliente_nome, data_hora, status, cliente_confirmou_em, equipe_confirmou_em, cancelamento_solicitado_por, cancelamento_confirmado_em, servicos(nome), funcionarios(nome)")
      .eq("barbearia_id", barbeariaId)
      .in("status", ["pendente", "confirmado"])
      .gte("data_hora", inicio.toISOString());
    if (pedido.data || pedido.hora) consulta = consulta.lt("data_hora", fim.toISOString());
    if (pedido.aprovar) consulta = consulta.eq("cancelamento_solicitado_por", "cliente");
    if (funcionarioId) consulta = consulta.or(`funcionario_id.eq.${funcionarioId},funcionario_id.is.null`);
    return consulta.order("data_hora").order("id").range(offset, offset + tamanhoPagina - 1);
  };

  const primeiraPagina = await buscarPagina(0);
  if (primeiraPagina.error) throw primeiraPagina.error;
  const corresponde = (agendamento: NonNullable<typeof primeiraPagina.data>[number]) => (
    (!cliente || ` ${normalizarNome(agendamento.cliente_nome)} `.includes(` ${cliente} `)) &&
    (!pedido.hora || formatarHora(new Date(agendamento.data_hora)) === pedido.hora)
  );
  const resultados = primeiraPagina.data.filter(corresponde);
  let totalNaPagina = primeiraPagina.data.length;
  for (let offset = tamanhoPagina; totalNaPagina === tamanhoPagina && resultados.length <= maxResultados; offset += tamanhoPagina) {
    const { data, error } = await buscarPagina(offset);
    if (error) throw error;
    resultados.push(...data.filter(corresponde));
    totalNaPagina = data.length;
  }
  return resultados;
}

export function CancelamentoNoChat({ barbeariaId, admin, pedido }: {
  barbeariaId: string;
  admin: boolean;
  pedido: PedidoCancelamentoChat;
}) {
  const { user } = useAuth();
  const filtroValido = Boolean(normalizarNome(pedido.cliente ?? "") || pedido.data || pedido.hora) &&
    (!pedido.data || dataValida(pedido.data)) && (!pedido.hora || horaValida(pedido.hora));
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["appointments", "cancelamento-chat", barbeariaId, user?.id, admin, pedido],
    queryFn: () => buscarAgendamentos(user!.id, barbeariaId, admin, pedido),
    enabled: !!user && filtroValido,
  });

  if (!filtroValido) return <p className="text-sm">Informe o cliente, a data ou o horário. Por exemplo, “Cancele o horário da Ana hoje às 15h”.</p>;
  if (isLoading) return <p role="status" className="text-sm text-muted-foreground">Buscando agendamentos...</p>;
  if (isError) return (
    <div className="space-y-2">
      <p className="text-sm">Não consegui buscar os agendamentos.</p>
      <Button size="sm" variant="outline" onClick={() => void refetch()}>Tentar novamente</Button>
    </div>
  );
  if (!data?.length) return (
    <p className="text-sm text-muted-foreground">
      {pedido.aprovar ? "Nenhum pedido do cliente aguardando aprovação." : "Não encontrei um agendamento ativo com esses dados."}
    </p>
  );

  return (
    <div className="space-y-2">
      {data.length > 1 && <p className="text-sm text-muted-foreground">Confira qual é o agendamento certo.</p>}
      {data.length > maxResultados && <p className="text-sm text-muted-foreground">Para refinar a busca, informe também o cliente e a data.</p>}
      {data.slice(0, maxResultados).map((agendamento) => (
        <div key={agendamento.id} className="space-y-2 rounded-xl border bg-card p-3">
          <div>
            <p className="text-sm font-semibold">{agendamento.cliente_nome}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(agendamento.data_hora).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              {agendamento.servicos?.nome && ` · ${agendamento.servicos.nome}`}
              {agendamento.funcionarios?.nome && ` · ${agendamento.funcionarios.nome}`}
            </p>
          </div>
          <AcoesAgendamento agendamento={agendamento} lado="equipe" somenteCancelamento />
        </div>
      ))}
    </div>
  );
}
