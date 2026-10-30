import { dataLocalISO, gerarHorarios, horaNoDia, intervalosLivres, ocupacoesDoDia, pausasDoDia } from "@/lib/agenda";

const dia = new Date(2026, 9, 17); // sexta, 17/10/2026
const h = (hora: string) => horaNoDia(dia, hora);
const antesDoDia = new Date(2026, 9, 16, 12);

describe("dataLocalISO", () => {
  it("usa a data local mesmo à noite", () => {
    expect(dataLocalISO(new Date(2026, 9, 17, 23, 30))).toBe("2026-10-17");
  });
});

describe("gerarHorarios", () => {
  it("só oferece horários em que o serviço inteiro cabe", () => {
    const horarios = gerarHorarios({
      abre: h("09:00"),
      fecha: h("11:00"),
      duracaoMin: 50,
      ocupados: [{ inicio: h("10:00"), fim: h("10:30") }],
      agora: antesDoDia,
    });

    expect(horarios).toEqual([
      { time: "09:00", isAvailable: true },
      { time: "09:30", isAvailable: false }, // 09:30–10:20 invade o agendamento das 10:00
      { time: "10:00", isAvailable: false },
    ]);
    // 10:30–11:20 passaria do fechamento, então nem aparece
  });

  it("omite horários que já passaram", () => {
    const horarios = gerarHorarios({
      abre: h("09:00"),
      fecha: h("11:00"),
      duracaoMin: 30,
      ocupados: [],
      agora: h("09:40"),
    });
    expect(horarios.map((x) => x.time)).toEqual(["10:00", "10:30"]);
  });
});

describe("intervalosLivres", () => {
  it("encontra os buracos da agenda a partir de agora", () => {
    const livres = intervalosLivres({
      abre: h("09:00"),
      fecha: h("18:00"),
      ocupados: [
        { inicio: h("13:00"), fim: h("13:30") },
        { inicio: h("10:00"), fim: h("11:00") },
        { inicio: h("11:00"), fim: h("11:45") },
      ],
      desde: h("09:50"),
    });

    expect(livres.map((l) => [l.inicio.getHours() * 60 + l.inicio.getMinutes(), l.fim.getHours() * 60 + l.fim.getMinutes()])).toEqual([
      [11 * 60 + 45, 13 * 60],
      [13 * 60 + 30, 18 * 60],
    ]);
  });
});

describe("pausasDoDia", () => {
  const pausas = [
    { funcionario_id: "rafael", data: "2026-10-17", hora_inicio: "12:00:00", hora_fim: "13:00:00" },
    { funcionario_id: "bruno", data: "2026-10-17", hora_inicio: "15:00", hora_fim: "15:30" },
    { funcionario_id: "rafael", data: "2026-10-18", hora_inicio: "12:00", hora_fim: "13:00" }, // outro dia
  ];

  it("com profissional escolhido, usa só as pausas dele naquele dia", () => {
    const [almoco, ...resto] = pausasDoDia(pausas, dia, "rafael", 2);
    expect(resto).toHaveLength(0);
    expect(almoco.inicio).toEqual(h("12:00"));
    expect(almoco.fim).toEqual(h("13:00"));
  });

  it("sem profissional escolhido, só bloqueia se a barbearia tiver um profissional", () => {
    expect(pausasDoDia(pausas, dia, null, 2)).toEqual([]);
    expect(pausasDoDia(pausas, dia, null, 1)).toHaveLength(2);
  });

  it("um horário que cruza a pausa fica indisponível", () => {
    const horarios = gerarHorarios({
      abre: h("11:00"),
      fecha: h("14:00"),
      duracaoMin: 30,
      ocupados: pausasDoDia(pausas, dia, "rafael", 2),
      agora: antesDoDia,
    });
    expect(horarios.filter((x) => !x.isAvailable).map((x) => x.time)).toEqual(["12:00", "12:30"]);
  });
});

describe("ocupacoesDoDia", () => {
  const ocupado = (hora: string, duracao: number, funcionario: string | null) => ({
    data_hora: h(hora).toISOString(),
    duracao_minutos: duracao,
    funcionario_id: funcionario,
  });
  const lista = [
    ocupado("09:00", 30, "rafael"),
    ocupado("10:00", 50, "bruno"),
    { data_hora: new Date(2026, 9, 18, 9).toISOString(), duracao_minutos: 30, funcionario_id: "rafael" }, // outro dia
  ];

  it("sem profissional escolhido, considera todos os agendamentos do dia", () => {
    const ocupacoes = ocupacoesDoDia(lista, dia);
    expect(ocupacoes).toHaveLength(2);
    expect(ocupacoes[1].fim.getTime() - ocupacoes[1].inicio.getTime()).toBe(50 * 60_000);
  });

  it("com profissional escolhido, considera só a agenda dele", () => {
    expect(ocupacoesDoDia(lista, dia, "bruno").map((o) => o.inicio.getHours())).toEqual([10]);
  });
});
