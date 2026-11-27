export const assuntos = ["agendamento", "cortes", "atendimentos", "faturamento", "gastos", "lucro", "resumo", "outro"] as const;
export const periodos = ["hoje", "ontem", "esta_semana", "semana_passada", "ultimos_7_dias", "este_mes", "mes_passado", "este_ano", "personalizado", "sem_periodo"] as const;
type Assunto = typeof assuntos[number];

export interface Metricas {
  atendimentos: number;
  cortes: number;
  faturamento: number | null;
  despesas: number | null;
  gastos: number | null;
  lucro: number | null;
}

export const assuntoValido = (assunto: unknown): assunto is Assunto =>
  assuntos.some((opcao) => opcao === assunto);

const diaISO = (dia: Date) => dia.toISOString().slice(0, 10);
const somarDias = (dia: Date, dias: number) => new Date(dia.getTime() + dias * 86_400_000);
const dataValida = (data: unknown): data is string => {
  if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const dia = new Date(`${data}T00:00:00Z`);
  return Number.isFinite(dia.getTime()) && diaISO(dia) === data;
};

export function hojeEmSaoPaulo(agora = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(agora);
}

export function intervaloGestao(
  hoje: string, assunto: Assunto, periodo: unknown, inicioPedido: unknown, fimPedido: unknown,
) {
  const data = new Date(`${hoje}T00:00:00Z`);
  const segunda = somarDias(data, -((data.getUTCDay() + 6) % 7));
  const ano = data.getUTCFullYear();
  const mes = data.getUTCMonth();
  const primeiroDoMes = new Date(Date.UTC(ano, mes, 1));
  const ontem = diaISO(somarDias(data, -1));
  const intervalos: Record<string, [string, string]> = {
    hoje: [hoje, hoje],
    ontem: [ontem, ontem],
    esta_semana: [diaISO(segunda), hoje],
    semana_passada: [diaISO(somarDias(segunda, -7)), diaISO(somarDias(segunda, -1))],
    ultimos_7_dias: [diaISO(somarDias(data, -6)), hoje],
    este_mes: [diaISO(primeiroDoMes), hoje],
    mes_passado: [diaISO(new Date(Date.UTC(ano, mes - 1, 1))), diaISO(somarDias(primeiroDoMes, -1))],
    este_ano: [`${ano}-01-01`, hoje],
  };

  if (periodo === "personalizado") {
    if (!dataValida(inicioPedido) || !dataValida(fimPedido)) return null;
    const fim = fimPedido > hoje ? hoje : fimPedido;
    if (inicioPedido > fim || Date.parse(fim) - Date.parse(inicioPedido) > 365 * 86_400_000) return null;
    return [inicioPedido, fim] as const;
  }
  if (typeof periodo === "string" && Object.hasOwn(intervalos, periodo)) return intervalos[periodo];
  return assunto === "cortes" || assunto === "atendimentos" ? intervalos.esta_semana : intervalos.este_mes;
}

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (data: string) => data.split("-").reverse().join("/");

export function respostaGestao(assunto: Assunto, inicio: string, fim: string, dados: Metricas) {
  const periodo = inicio === fim ? dataBR(inicio) : `${dataBR(inicio)} a ${dataBR(fim)}`;
  const cortes = dados.cortes === 1 ? "1 corte finalizado" : `${dados.cortes} cortes finalizados`;
  const atendimentos = dados.atendimentos === 1 ? "1 atendimento finalizado" : `${dados.atendimentos} atendimentos finalizados`;
  const faturamento = dados.faturamento === null ? null : `Faturamento estimado: ${reais.format(dados.faturamento)}, pelos preços atuais dos serviços finalizados.`;
  const gastos = dados.gastos === null ? null : dados.despesas
    ? `Gastos registrados: ${reais.format(dados.gastos)} (${dados.despesas === 1 ? "1 lançamento" : `${dados.despesas} lançamentos`}).`
    : "Nenhum gasto registrado no período.";
  const lucro = dados.lucro === null
    ? "Registre os gastos do período para estimar o lucro."
    : `${dados.lucro < 0 ? "Prejuízo estimado" : "Lucro estimado"}: ${reais.format(Math.abs(dados.lucro))}, considerando os gastos registrados.`;

  const linhas = {
    cortes: [`${cortes} no período.`],
    atendimentos: [`${atendimentos} no período.`],
    faturamento: [faturamento],
    gastos: [gastos],
    lucro: [faturamento, gastos, lucro],
    resumo: [`${atendimentos}, incluindo ${cortes}.`, faturamento, gastos, faturamento && lucro],
  };
  if (assunto === "agendamento" || assunto === "outro") return "";
  return [periodo, ...linhas[assunto].filter(Boolean)].join("\n");
}
