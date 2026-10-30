import type { Database } from "@/integrations/supabase/types";

export type HorarioDia = Pick<
  Database["public"]["Tables"]["horarios_funcionamento"]["Row"],
  "dia_semana" | "fechado" | "hora_abre" | "hora_fecha"
>;

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type HorarioAberto = HorarioDia & { hora_abre: string; hora_fecha: string };

const diasAbertos = (horarios: HorarioDia[]): HorarioAberto[] =>
  horarios
    .filter((h): h is HorarioAberto => !h.fechado && !!h.hora_abre && !!h.hora_fecha)
    .sort((a, b) => a.dia_semana - b.dia_semana);

const paraMinutos = (hora: string) => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Formata os dias abertos: faixa contínua vira "Seg - Sáb", senão lista "Seg, Qua, Sex". */
const formatarDias = (dias: number[]) => {
  if (dias.length === 0) return "";
  if (dias.length === 1) return DIAS_SEMANA[dias[0]];
  const continuo = dias.every((dia, i) => i === 0 || dia === dias[i - 1] + 1);
  return continuo
    ? `${DIAS_SEMANA[dias[0]]} - ${DIAS_SEMANA[dias[dias.length - 1]]}`
    : dias.map((d) => DIAS_SEMANA[d]).join(", ");
};

/**
 * Resume os horários de funcionamento para exibição.
 * Quando os dias têm horários diferentes, mostra da abertura mais cedo ao fechamento mais tarde.
 */
export function resumirHorarios(horarios: HorarioDia[] | null | undefined) {
  const abertos = diasAbertos(horarios ?? []);
  if (abertos.length === 0) return null;

  const abre = abertos.reduce((min, h) => (paraMinutos(h.hora_abre) < paraMinutos(min) ? h.hora_abre : min), abertos[0].hora_abre);
  const fecha = abertos.reduce((max, h) => (paraMinutos(h.hora_fecha) > paraMinutos(max) ? h.hora_fecha : max), abertos[0].hora_fecha);

  return {
    horas: `${abre.slice(0, 5)} - ${fecha.slice(0, 5)}`,
    dias: formatarDias(abertos.map((h) => h.dia_semana)),
  };
}

const NOMES_DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/**
 * Horário de cada dia, de segunda a domingo, para a página pública.
 * O resumo do topo junta os dias ("Seg - Sáb · 08:00 - 18:00") e esconde quando um dia fecha mais cedo.
 */
export function horariosDaSemana(horarios: HorarioDia[] | null | undefined) {
  const abertos = diasAbertos(horarios ?? []);
  return [1, 2, 3, 4, 5, 6, 0].map((dia) => {
    const h = abertos.find((x) => x.dia_semana === dia);
    return {
      dia,
      nome: NOMES_DIAS[dia],
      horario: h ? `${h.hora_abre.slice(0, 5)} - ${h.hora_fecha.slice(0, 5)}` : null,
    };
  });
}

export function estaAberto(horarios: HorarioDia[] | null | undefined, agora = new Date()) {
  const hoje = diasAbertos(horarios ?? []).find((h) => h.dia_semana === agora.getDay());
  if (!hoje) return false;
  const minutos = agora.getHours() * 60 + agora.getMinutes();
  return minutos >= paraMinutos(hoje.hora_abre) && minutos < paraMinutos(hoje.hora_fecha);
}
