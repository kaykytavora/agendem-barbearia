import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agendarPeloChat } from "@/lib/agendamento-equipe";
import { interpretarAgendamentoSimples } from "@/lib/agendamento-assistido";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  createAppointment: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock("@/integrations/supabase/api", () => ({ createAppointment: mocks.createAppointment }));

describe("agendamento pelo chat da equipe", () => {
  const comando = "agende um corte de cabelo para kayky com daniel as 15";
  const comandoCombinado = "Agende corte de cabelo com sobrancelha de vitoria com kayky";
  const dados: Record<string, object | object[]> = {
    servicos: [{ id: "cabelo", nome: "Cabelo", duracao_minutos: 45 }],
    funcionarios: [{ id: "daniel", nome: "Daniel Dam" }],
    horarios_funcionamento: { dia_semana: 5, fechado: false, hora_abre: "08:00", hora_fecha: "19:00" },
    funcionario_pausas: [],
    funcionario_ausencias: [],
    agendamentos: [{ cliente_nome: "Kayky Tavora", cliente_telefone: "11999990000" }],
  };
  let registros: typeof dados;

  beforeEach(() => {
    vi.clearAllMocks();
    registros = { ...dados };
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 27, 14, 48));
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    mocks.from.mockImplementation((tabela: string) => {
      const resultado = Promise.resolve({ data: registros[tabela], error: null });
      const query = {
        select: () => query,
        eq: () => query,
        ilike: () => query,
        order: () => query,
        lte: () => query,
        gte: () => query,
        limit: () => resultado,
        range: () => resultado,
        maybeSingle: () => resultado,
        then: resultado.then.bind(resultado),
      };
      return query;
    });
  });

  afterEach(() => vi.useRealTimers());

  it("confirma o horário do print com um contato inequívoco da própria barbearia", async () => {
    const pedido = interpretarAgendamentoSimples(comando)!;
    expect(pedido).toMatchObject({ cliente: "kayky", profissional: "daniel", hora: "15:00" });
    expect((await agendarPeloChat("barbearia", pedido)).criado).toBe(true);
    expect(mocks.createAppointment).toHaveBeenCalledOnce();
    expect(mocks.createAppointment).toHaveBeenCalledWith(expect.objectContaining({
      barbearia_id: "barbearia",
      cliente_nome: "Kayky Tavora",
      cliente_telefone: "11999990000",
      data_hora: new Date(2026, 10, 27, 15).toISOString(),
      funcionario_id: "daniel",
      servico_id: "cabelo",
    }), { carregarDetalhes: false });
  });

  it("pede telefone para um cliente sem histórico e aceita a resposta sem formulário", async () => {
    const pedido = interpretarAgendamentoSimples("agende um corte para as 15:00 de Ana com funcionario Daniel")!;
    expect(pedido).toMatchObject({ cliente: "Ana", profissional: "Daniel", hora: "15:00" });
    expect((await agendarPeloChat("barbearia", pedido)).falta).toBe("telefone");
    expect(mocks.createAppointment).not.toHaveBeenCalled();
    expect((await agendarPeloChat("barbearia", { ...pedido, telefone: "11988880000" })).criado).toBe(true);
  });

  it("sugere outro horário quando um serviço coincidir com um atendimento existente", async () => {
    const pedido = interpretarAgendamentoSimples(comando)!;
    mocks.rpc.mockResolvedValue({
      data: [{ data_hora: new Date(2026, 10, 27, 15, 30).toISOString(), duracao_minutos: 30, funcionario_id: "daniel" }],
      error: null,
    });
    expect(await agendarPeloChat("barbearia", pedido)).toMatchObject({
      falta: "hora", texto: expect.stringContaining("15:00 está indisponível"),
    });
    expect(mocks.createAppointment).not.toHaveBeenCalled();
  });

  it("respeita uma data explícita e deixa datas incompletas para a IA", () => {
    expect(interpretarAgendamentoSimples("agende um corte para Ana com Daniel dia 28/11 às 15h"))
      .toMatchObject({ data: "2026-11-28", hora: "15:00" });
    expect(interpretarAgendamentoSimples("agende um corte para Ana com Daniel dia 28 às 15h")).toBeNull();
  });

  it("interpreta o pedido do print e pergunta a hora para o combo correto", async () => {
    registros.servicos = [
      { id: "duo", nome: "Sobrancelha + Cabelo", duracao_minutos: 45 },
      { id: "trio", nome: "Cabelo + Sobrancelha + Barba", duracao_minutos: 60 },
    ];
    registros.funcionarios = [{ id: "kayky", nome: "Kayky Tavora" }];
    const pedido = interpretarAgendamentoSimples(comandoCombinado)!;
    expect(pedido).toMatchObject({
      cliente: "vitoria", profissional: "kayky", servico: "corte de cabelo com sobrancelha", hora: null,
    });
    expect((await agendarPeloChat("barbearia", pedido)).falta).toBe("hora");
    expect(mocks.createAppointment).not.toHaveBeenCalled();
    expect((await agendarPeloChat("barbearia", { ...pedido, hora: "15:00", telefone: "11988880000" })).criado).toBe(true);
    expect(mocks.createAppointment).toHaveBeenCalledWith(expect.objectContaining({ servico_id: "duo" }), expect.anything());
  });

  it("pede escolha de serviço se o único combo disponível também inclui barba", async () => {
    registros.servicos = [{ id: "trio", nome: "Cabelo + Sobrancelha + Barba", duracao_minutos: 60 }];
    const pedido = interpretarAgendamentoSimples(comandoCombinado)!;
    expect((await agendarPeloChat("barbearia", pedido)).falta).toBe("servico");
    expect(mocks.createAppointment).not.toHaveBeenCalled();
  });
});
