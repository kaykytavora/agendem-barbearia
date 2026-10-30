/** Período ocupado na agenda (um agendamento existente). */
export interface Ocupacao {
  inicio: Date;
  fim: Date;
}

export interface Horario {
  time: string; // "HH:MM"
  isAvailable: boolean;
}

const MINUTO = 60_000;

/** Data local no formato YYYY-MM-DD (toISOString usaria UTC e trocaria o dia à noite). */
export function dataLocalISO(data: Date): string {
  const y = data.getFullYear();
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatarHora(data: Date): string {
  return `${String(data.getHours()).padStart(2, "0")}:${String(data.getMinutes()).padStart(2, "0")}`;
}

/** Monta um Date no dia informado a partir de "HH:MM" ou "HH:MM:SS". */
export function horaNoDia(dia: Date, hora: string): Date {
  const [h, m] = hora.split(":").map(Number);
  const resultado = new Date(dia);
  resultado.setHours(h, m || 0, 0, 0);
  return resultado;
}

const sobrepoe = (inicio: Date, fim: Date, ocupacao: Ocupacao) =>
  inicio.getTime() < ocupacao.fim.getTime() && fim.getTime() > ocupacao.inicio.getTime();

/**
 * Gera os horários de início possíveis para um serviço.
 * Um horário só fica disponível se o serviço inteiro (início + duração) cabe antes do
 * fechamento e não se sobrepõe a nenhum agendamento. Horários que já passaram são omitidos.
 */
export function gerarHorarios(opcoes: {
  abre: Date;
  fecha: Date;
  duracaoMin: number;
  ocupados: Ocupacao[];
  agora?: Date;
  intervaloMin?: number;
}): Horario[] {
  const { abre, fecha, duracaoMin, ocupados, agora = new Date(), intervaloMin = 30 } = opcoes;
  const horarios: Horario[] = [];

  for (let t = abre.getTime(); t + duracaoMin * MINUTO <= fecha.getTime(); t += intervaloMin * MINUTO) {
    if (t < agora.getTime()) continue;
    const inicio = new Date(t);
    const fim = new Date(t + duracaoMin * MINUTO);
    horarios.push({
      time: formatarHora(inicio),
      isAvailable: !ocupados.some((o) => sobrepoe(inicio, fim, o)),
    });
  }

  return horarios;
}

/**
 * Intervalos sem agendamento entre `desde` e o fechamento, com pelo menos `minimoMin` minutos.
 */
export function intervalosLivres(opcoes: {
  abre: Date;
  fecha: Date;
  ocupados: Ocupacao[];
  desde?: Date;
  minimoMin?: number;
}): Ocupacao[] {
  const { abre, fecha, ocupados, desde = abre, minimoMin = 30 } = opcoes;
  const livres: Ocupacao[] = [];
  let cursor = Math.max(abre.getTime(), desde.getTime());

  const ordenados = [...ocupados].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  for (const o of ordenados) {
    if (o.inicio.getTime() - cursor >= minimoMin * MINUTO) {
      livres.push({ inicio: new Date(cursor), fim: new Date(Math.min(o.inicio.getTime(), fecha.getTime())) });
    }
    cursor = Math.max(cursor, o.fim.getTime());
  }
  if (fecha.getTime() - cursor >= minimoMin * MINUTO) {
    livres.push({ inicio: new Date(cursor), fim: new Date(fecha) });
  }

  return livres;
}

/** Horário ocupado como vem da função horarios_ocupados (sem dados de clientes). */
export interface HorarioOcupado {
  data_hora: string;
  duracao_minutos: number;
  funcionario_id: string | null;
}

/** Pausa de um profissional (tabela funcionario_pausas): data "YYYY-MM-DD" e horas "HH:MM[:SS]". */
export interface PausaProfissional {
  funcionario_id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
}

/**
 * Pausas que bloqueiam horários num dia. Com um profissional escolhido, só as dele contam.
 * Sem escolha ("qualquer profissional"), a pausa só bloqueia se a barbearia tiver um único
 * profissional; com mais de um, outro pode atender naquele horário.
 */
export function pausasDoDia(
  pausas: PausaProfissional[],
  dia: Date,
  funcionarioId: string | null,
  totalProfissionais: number
): Ocupacao[] {
  if (!funcionarioId && totalProfissionais !== 1) return [];
  const alvo = dataLocalISO(dia);
  return pausas
    .filter((p) => p.data === alvo && (!funcionarioId || p.funcionario_id === funcionarioId))
    .map((p) => ({ inicio: horaNoDia(dia, p.hora_inicio), fim: horaNoDia(dia, p.hora_fim) }));
}

/**
 * Períodos ocupados num dia. Com um profissional escolhido, só a agenda dele conta;
 * sem escolha ("qualquer profissional"), qualquer agendamento bloqueia o horário.
 */
export function ocupacoesDoDia(horarios: HorarioOcupado[], dia: Date, funcionarioId: string | null = null): Ocupacao[] {
  const alvo = dataLocalISO(dia);
  return horarios
    .filter((h) => !funcionarioId || h.funcionario_id === funcionarioId)
    .map((h) => {
      const inicio = new Date(h.data_hora);
      return { inicio, fim: new Date(inicio.getTime() + (h.duracao_minutos || 30) * MINUTO) };
    })
    .filter((o) => dataLocalISO(o.inicio) === alvo);
}
