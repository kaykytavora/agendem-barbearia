import { FunctionsHttpError } from "@supabase/supabase-js";
import { dataLocalISO } from "@/lib/agenda";

export interface RascunhoAgendamento {
  cliente: string | null;
  servico: string | null;
  profissional: string | null;
  data: string | null;
  hora: string | null;
  telefone?: string | null;
}

export function normalizarNome(nome: string) {
  return nome.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim();
}

export function encontrarPorNome<T extends { nome: string }>(
  opcoes: T[],
  pedido: string | null,
  apelidos: string[] = [],
): T | undefined {
  const nome = normalizarNome(pedido ?? "");
  if (!nome) return;

  const nomes = opcoes.map((opcao) => ({ opcao, nome: normalizarNome(opcao.nome) }));
  const exatos = nomes.filter((item) => item.nome === nome);
  if (exatos.length) return exatos.length === 1 ? exatos[0].opcao : undefined;

  if (apelidos.length) {
    const alternativas = nomes.filter((item) => apelidos.includes(item.nome));
    return alternativas.length === 1 ? alternativas[0].opcao : undefined;
  }

  const parciais = nomes.filter((item) => ` ${item.nome} `.includes(` ${nome} `));
  return parciais.length === 1 ? parciais[0].opcao : undefined;
}

const nomesDeCorte = ["cabelo", "corte", "corte de cabelo"];
const nomesDeSobrancelha = ["sobrancelha", "sobrancelhas", "design de sobrancelha", "design de sobrancelhas"];

function partesDoServico(nome: string) {
  return nome.replace(/^combo\b\s*[:–-]?\s*/i, "").split(/\s*[+&]\s*|\s+(?:com|e)\s+/i)
    .map(normalizarNome).filter(Boolean)
    .map((parte) => {
      if (nomesDeCorte.includes(parte)) return "cabelo";
      if (nomesDeSobrancelha.includes(parte)) return "sobrancelha";
      return parte;
    });
}

export function encontrarServico<T extends { nome: string }>(opcoes: T[], pedido: string | null) {
  const partes = partesDoServico(pedido ?? "");
  if (partes.length > 1) {
    const assinatura = partes.sort().join("+");
    const correspondencias = opcoes.filter((opcao) => partesDoServico(opcao.nome).sort().join("+") === assinatura);
    return correspondencias.length === 1 ? correspondencias[0] : undefined;
  }

  const nome = normalizarNome(pedido ?? "");
  return encontrarPorNome(
    opcoes.filter((opcao) => partesDoServico(opcao.nome).length === 1),
    pedido,
    nomesDeCorte.includes(nome) ? nomesDeCorte : [],
  );
}

export function telefoneLocal(texto: string) {
  let digitos = texto.replace(/\D/g, "");
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    digitos = digitos.slice(2);
  }
  return /^\d{10,11}$/.test(digitos) ? digitos : null;
}

export function extrairTelefone(texto: string) {
  const telefone = texto.match(/(?:(?:telefone|whatsapp|fone)\s*[:,-]?\s*)?(?:\+55\s*)?(?:\(\d{2}\)|\b\d{2})[\s.-]?\d{4,5}[\s.-]?\d{4}\b/i);
  return {
    telefone: telefone ? telefoneLocal(telefone[0]) : null,
    comando: telefone ? texto.replace(telefone[0], " ").replace(/[,;\s]+$/, "").trim() : texto,
  };
}

export const horaValida = (hora: string | null) => Boolean(hora && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hora));

export function dataValida(data: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(data) && dataLocalISO(new Date(`${data}T00:00:00`)) === data;
}

export function extrairDataHora(texto: string, agora = new Date()) {
  const marcaData = texto.match(/\b(?:depois de amanh[ãa]|amanh[ãa]|hoje|(?:dia\s+)?(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{4})?))(?!\p{L})/iu);
  let data: string | null = null;
  if (marcaData) {
    const trecho = marcaData[0].replace(/^dia\s+/i, "");
    const termo = normalizarNome(trecho);
    if (["hoje", "amanha", "depois de amanha"].includes(termo)) {
      const dia = new Date(agora);
      dia.setDate(dia.getDate() + (termo === "hoje" ? 0 : termo === "amanha" ? 1 : 2));
      data = dataLocalISO(dia);
    } else if (trecho.includes("/")) {
      const [dia, mes, ano = String(agora.getFullYear())] = trecho.split("/");
      data = `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
    } else {
      data = trecho;
    }
  }
  const semData = marcaData ? texto.replace(marcaData[0], " ") : texto;
  const marcaHora = semData.match(/(?:(?:para\s+)?[àa]s\s+)(\d{1,2})(?:[:h](\d{2})|h)?(?![\d:h])/i)
    ?? semData.match(/^\s*(\d{1,2})(?:[:h](\d{2})|h)?\s*$/i)
    ?? semData.match(/\b(\d{1,2})(?:[:h](\d{2})|h)(?!\d)/i);
  const hora = marcaHora ? `${marcaHora[1].padStart(2, "0")}:${marcaHora[2] ?? "00"}` : null;
  return { data, hora, marcaData: marcaData?.[0], marcaHora: marcaHora?.[0] };
}

export function interpretarAgendamentoSimples(texto: string): RascunhoAgendamento | null {
  const { telefone, comando } = extrairTelefone(texto.trim());
  const acao = comando.match(/^(?:agend[ae]|agendar|marq(?:ue|uar)|marcar|reserv[ae]|reservar)\s+(?:(?:um|uma)\s+)?/i);
  if (!acao) return null;

  const periodo = extrairDataHora(comando);
  if (/\b(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo|pr[óo]xim[oa]|semana|m[êe]s)\b/i.test(comando) ||
      /\b(?:dia\s+\d+|da manh[ãa]|da tarde|da noite)\b/i.test(comando.replace(periodo.marcaData ?? "", " "))) return null;
  let pedido = comando.slice(acao[0].length);
  if (periodo.marcaData) pedido = pedido.replace(periodo.marcaData, " ");
  if (periodo.marcaHora) {
    const indice = pedido.indexOf(periodo.marcaHora);
    const antes = pedido.slice(0, indice);
    const depois = pedido.slice(indice + periodo.marcaHora.length);
    pedido = antes + depois.replace(/^\s+de\s+/i, " para ");
  }

  pedido = pedido.replace(/\s+/g, " ").trim();
  const separador = pedido.match(/\s+para\s+/i)
    ?? pedido.match(/\s+de\s+(?!(?:cabelos?|barbas?|sobrancelhas?|pezinho|grisalhos?)\b)/i);
  if (separador?.index === undefined) return null;

  const servico = pedido.slice(0, separador.index).trim();
  const destinatario = pedido.slice(separador.index + separador[0].length);
  const partes = destinatario.match(/^(.+?)(?:\s+com\s+(?:(?:o|a)\s+)?(?:(?:funcion[áa]ri[oa]|barbeir[oa]|profissional)\s+)?(.+))?$/i);
  if (!servico || !partes || !/^[\p{L}][\p{L}\p{M} .'’-]*$/u.test(partes[1])) return null;
  return {
    cliente: partes[1].trim(),
    servico,
    profissional: partes[2]?.trim() ?? null,
    data: periodo.data,
    hora: periodo.hora,
    telefone,
  };
}

export function pediuParaAgendar(texto: string) {
  return /^(?:por favor[, ]+)?(?:(?:pode|poderia|voc[eê] pode|quero|preciso)\s+)?(?:agende|agendar|marque|marcar|reserve|reservar)\b/i.test(texto.trim());
}

export interface PedidoCancelamentoChat {
  cliente: string | null;
  data: string | null;
  hora: string | null;
  aprovar: boolean;
}

const comandoCancelamento = /^(?:por favor[, ]+)?(?:(?:pode|poderia|voc[eê] pode|quero|preciso(?: de)?|gostaria de)\s+)?(?:(cancele|cancela|cancelar)|(?:pe[çc]a|pedir|solicite|solicitar)\s+(?:o\s+)?cancelamento|((?:aprove|aprovar|confirme|confirmar)\s+(?:o\s+)?cancelamento))\b/i;

export function interpretarCancelamentoSimples(texto: string): PedidoCancelamentoChat | null {
  const comando = extrairTelefone(texto.trim()).comando.replace(/\bdas\s+(?=\d)/i, "às ");
  const acao = comando.match(comandoCancelamento);
  if (!acao) return null;

  const { data, hora, marcaData, marcaHora } = extrairDataHora(comando);
  let cliente = comando.slice(acao[0].length).trim();
  if (marcaData) cliente = cliente.replace(marcaData, " ");
  if (marcaHora) cliente = cliente.replace(marcaHora, " ");
  cliente = cliente.trim()
    .replace(/\b(?:de|d[ao]s?|[àa]s|para|em|no|na)\s*[,.!?]*$/i, "")
    .replace(/\bpor favor\b[,!.?]*/gi, "")
    .replace(/^(?:(?:o|a|um|uma|do|da|de)\s+)?(?:agendamento|hor[áa]rio|reserva)\b\s*/i, "")
    .replace(/^(?:d[ao] cliente|de|da|do|para)\s+/i, "")
    .replace(/^cliente\s+/i, "")
    .replace(/[,!?]+$/g, "")
    .trim();

  // Datas relativas mais complexas e pedidos com detalhes adicionais passam pela IA.
  if (/[\d]/.test(cliente) ||
    /\b(?:segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo|ontem|pr[óo]xim[oa]|semana|m[êe]s|com|manh[ãa]|tarde|noite)\b/i.test(cliente)) return null;
  return { cliente: cliente || null, data, hora, aprovar: Boolean(acao[2]) };
}

export const pediuParaCancelar = (texto: string) => comandoCancelamento.test(texto.trim());

export async function mensagemErroAssistente(erro: unknown) {
  if (erro instanceof FunctionsHttpError) {
    if (erro.context.status === 404) return "A função de IA ainda não foi publicada no Supabase.";
    if (erro.context.status === 401) return "Entre novamente no painel para usar o assistente.";
    if (erro.context.status === 403) return "O assistente está disponível para a equipe da barbearia.";
    const body: { error?: string } | null = await erro.context.clone().json().catch(() => null);
    if (body?.error) return body.error;
  }
  return "Não consegui acessar a IA agora. Tente novamente.";
}
