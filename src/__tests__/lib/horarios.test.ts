import { estaAberto, horariosDaSemana, resumirHorarios, type HorarioDia } from "@/lib/horarios";

const dia = (dia_semana: number, hora_abre: string | null, hora_fecha: string | null, fechado = false): HorarioDia => ({
  dia_semana,
  hora_abre,
  hora_fecha,
  fechado,
});

const segASab = [1, 2, 3, 4, 5, 6].map((d) => dia(d, "08:00:00", "18:00:00"));

describe("resumirHorarios", () => {
  it("retorna null sem horários abertos", () => {
    expect(resumirHorarios([])).toBeNull();
    expect(resumirHorarios(null)).toBeNull();
    expect(resumirHorarios([dia(0, null, null, true)])).toBeNull();
  });

  it("resume uma faixa contínua de dias", () => {
    expect(resumirHorarios([dia(0, null, null, true), ...segASab])).toEqual({
      horas: "08:00 - 18:00",
      dias: "Seg - Sáb",
    });
  });

  it("lista dias não contínuos e usa a maior janela de horário", () => {
    expect(resumirHorarios([dia(5, "09:00", "20:00"), dia(1, "08:00", "18:00"), dia(3, "10:00", "19:00")])).toEqual({
      horas: "08:00 - 20:00",
      dias: "Seg, Qua, Sex",
    });
  });
});

describe("horariosDaSemana", () => {
  it("lista de segunda a domingo e mostra o sábado que fecha mais cedo", () => {
    const semana = horariosDaSemana([dia(0, null, null, true), ...segASab.slice(0, 5), dia(6, "08:00:00", "17:00:00")]);
    expect(semana.map((d) => d.nome)).toEqual(["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"]);
    expect(semana[5].horario).toBe("08:00 - 17:00");
    expect(semana[6].horario).toBeNull();
  });
});

describe("estaAberto", () => {
  // 14/10/2026 é uma quarta-feira (dia 3)
  const quarta = (h: number, m = 0) => new Date(2026, 9, 14, h, m);

  it("considera o intervalo de abertura do dia", () => {
    expect(estaAberto(segASab, quarta(8))).toBe(true);
    expect(estaAberto(segASab, quarta(17, 59))).toBe(true);
    expect(estaAberto(segASab, quarta(18))).toBe(false);
    expect(estaAberto(segASab, quarta(7, 59))).toBe(false);
  });

  it("retorna false em dia fechado", () => {
    expect(estaAberto(segASab, new Date(2026, 9, 18, 12))).toBe(false); // domingo
  });
});
