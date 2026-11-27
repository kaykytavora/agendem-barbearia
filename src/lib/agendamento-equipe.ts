import { supabase } from "@/integrations/supabase/client";
import { caminhoAgendamento, createAppointment } from "@/integrations/supabase/api";
import { dataLocalISO, gerarHorarios, horaNoDia, ocupacoesDoDia, pausasDoDia } from "@/lib/agenda";
import type { HorarioDia } from "@/lib/horarios";
import { dataValida, encontrarPorNome, encontrarServico, horaValida, normalizarNome, telefoneLocal, type RascunhoAgendamento } from "@/lib/agendamento-assistido";

export async function horariosDaEquipe(
  barbeariaId: string,
  data: string,
  duracaoMin: number,
  horario: HorarioDia | undefined,
  funcionarioId: string | null,
  totalProfissionais: number,
) {
  if (!horario?.hora_abre || !horario.hora_fecha || horario.fechado) return [];

  const dia = new Date(`${data}T00:00:00`);
  const diaSeguinte = new Date(dia);
  diaSeguinte.setDate(dia.getDate() + 1);
  const [ocupados, pausas, ausencias] = await Promise.all([
    supabase.rpc("horarios_ocupados", {
      p_barbearia_id: barbeariaId,
      p_de: dia.toISOString(),
      p_ate: diaSeguinte.toISOString(),
    }),
    supabase.from("funcionario_pausas").select("funcionario_id, data, hora_inicio, hora_fim")
      .eq("barbearia_id", barbeariaId).eq("data", data),
    funcionarioId
      ? supabase.from("funcionario_ausencias").select("id")
        .eq("funcionario_id", funcionarioId).lte("data_inicio", data).gte("data_fim", data).limit(1)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (ocupados.error) throw ocupados.error;
  if (pausas.error) throw pausas.error;
  if (ausencias.error) throw ausencias.error;
  if (ausencias.data?.length) return [];

  return gerarHorarios({
    abre: horaNoDia(dia, horario.hora_abre),
    fecha: horaNoDia(dia, horario.hora_fecha),
    duracaoMin,
    ocupados: [
      ...ocupacoesDoDia(ocupados.data ?? [], dia, funcionarioId),
      ...pausasDoDia(pausas.data ?? [], dia, funcionarioId, totalProfissionais),
    ],
  });
}

async function acharContato(barbeariaId: string, nome: string) {
  const busca = nome.replace(/[^\p{L}\p{M} .'’-]/gu, "").trim().replace(/\s+/g, " ");
  const nomeNormalizado = normalizarNome(busca);
  if (!nomeNormalizado) return null;

  let contato: { nome: string; telefone: string } | null = null;
  const tamanhoPagina = 100;
  for (let inicio = 0; ; inicio += tamanhoPagina) {
    const { data, error } = await supabase.from("agendamentos").select("cliente_nome, cliente_telefone")
      .eq("barbearia_id", barbeariaId).ilike("cliente_nome", `${busca}%`)
      .order("id").range(inicio, inicio + tamanhoPagina - 1);
    if (error) throw error;
    for (const registro of data) {
      const nome = normalizarNome(registro.cliente_nome);
      if (nome !== nomeNormalizado && !nome.startsWith(`${nomeNormalizado} `)) continue;
      const telefone = telefoneLocal(registro.cliente_telefone);
      if (!telefone) continue;
      if (contato && (contato.telefone !== telefone || normalizarNome(contato.nome) !== nome)) return null;
      contato = { nome: registro.cliente_nome, telefone };
    }
    if (data.length < tamanhoPagina) return contato;
  }
}

export type CampoAgendamento = "cliente" | "servico" | "profissional" | "data" | "hora" | "telefone";
type ResultadoAgendamento = { texto: string; falta?: CampoAgendamento; criado?: true; linkCliente?: { id: string; caminho: string } };

function minutos(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export async function agendarPeloChat(barbeariaId: string, rascunho: RascunhoAgendamento): Promise<ResultadoAgendamento> {
  if (!rascunho.cliente || rascunho.cliente.trim().length < 2) {
    return { texto: "Qual é o nome do cliente?", falta: "cliente" };
  }
  if (!rascunho.servico) return { texto: "Qual serviço você quer agendar?", falta: "servico" };
  const agora = new Date();
  const hoje = dataLocalISO(agora);
  const data = rascunho.data ?? hoje;
  if (!dataValida(data) || data < hoje) {
    return { texto: "Qual é a data do atendimento? Você pode dizer “amanhã” ou informar dia e mês.", falta: "data" };
  }
  const dia = new Date(`${data}T00:00:00`);

  const [servicos, equipe, expediente] = await Promise.all([
    supabase.from("servicos").select("id, nome, duracao_minutos").eq("barbearia_id", barbeariaId).order("nome"),
    supabase.from("funcionarios").select("id, nome").eq("barbearia_id", barbeariaId).order("nome"),
    supabase.from("horarios_funcionamento").select("dia_semana, fechado, hora_abre, hora_fecha")
      .eq("barbearia_id", barbeariaId).eq("dia_semana", dia.getDay()).maybeSingle(),
  ]);
  if (servicos.error) throw servicos.error;
  if (equipe.error) throw equipe.error;
  if (expediente.error) throw expediente.error;

  if (!servicos.data.length) return { texto: "Cadastre um serviço na barbearia antes de agendar pelo chat." };
  if (!equipe.data.length) return { texto: "Cadastre um profissional na barbearia antes de agendar pelo chat." };
  const servico = encontrarServico(servicos.data, rascunho.servico);
  if (!servico) {
    return {
      texto: `Qual serviço devo usar? Alguns serviços cadastrados: ${servicos.data.slice(0, 5).map(({ nome }) => nome).join(", ")}.`,
      falta: "servico",
    };
  }
  const profissional = rascunho.profissional
    ? encontrarPorNome(equipe.data, rascunho.profissional)
    : equipe.data.length === 1 ? equipe.data[0] : undefined;
  if (!profissional) {
    return {
      texto: `Com qual profissional? Você pode escrever o nome completo. Na equipe: ${equipe.data.slice(0, 5).map(({ nome }) => nome).join(", ")}.`,
      falta: "profissional",
    };
  }

  const livres = (await horariosDaEquipe(barbeariaId, data, servico.duracao_minutos, expediente.data ?? undefined, profissional.id, equipe.data.length))
    .filter((horario) => horario.isAvailable);
  const dataBR = dia.toLocaleDateString("pt-BR");
  if (!livres.length) {
    return { texto: `${profissional.nome} está sem horários livres para ${servico.nome} em ${dataBR}. Qual outra data funciona?`, falta: "data" };
  }
  const hora = rascunho.hora;
  if (!hora || !horaValida(hora) || !livres.some((horario) => horario.time === hora)) {
    const alvo = hora && horaValida(hora) ? minutos(hora) : null;
    const sugestoes = [...livres]
      .sort((a, b) => alvo === null ? 0 : Math.abs(minutos(a.time) - alvo) - Math.abs(minutos(b.time) - alvo))
      .slice(0, 4).map((horario) => horario.time).join(", ");
    const mensagem = hora && horaValida(hora) ? `${hora} está indisponível` : "Qual horário você prefere";
    return { texto: `${mensagem} em ${dataBR}? Horários livres: ${sugestoes}. Você também pode pedir outra data.`, falta: "hora" };
  }

  const telefone = rascunho.telefone ? telefoneLocal(rascunho.telefone) : null;
  const contato = telefone ? { nome: rascunho.cliente, telefone } : await acharContato(barbeariaId, rascunho.cliente);
  if (!contato) return { texto: `Qual é o telefone de ${rascunho.cliente} com DDD?`, falta: "telefone" };

  try {
    const agendamento = await createAppointment({
      barbearia_id: barbeariaId,
      cliente_nome: contato.nome,
      cliente_telefone: contato.telefone,
      cliente_email: null,
      data_hora: horaNoDia(dia, hora).toISOString(),
      funcionario_id: profissional.id,
      servico_id: servico.id,
      user_id: null,
      avaliado: false,
    }, { carregarDetalhes: false });
    return {
      criado: true,
      linkCliente: { id: agendamento.id, caminho: caminhoAgendamento(agendamento.id, agendamento.booking_token) },
      texto: `Horário reservado. Aguardando confirmação do cliente.\n${contato.nome} · ${servico.nome}\n${dataBR} às ${hora} com ${profissional.nome}.`,
    };
  } catch (erro) {
    if (erro instanceof Error && erro.message.startsWith("Esse horário já está reservado")) {
      return { texto: "Esse horário acabou de ser ocupado. Qual outro horário ou data você prefere?", falta: "hora" };
    }
    if (erro instanceof Error && erro.message.startsWith("Este telefone atingiu")) return { texto: erro.message };
    throw erro;
  }
}
