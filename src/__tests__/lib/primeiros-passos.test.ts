import { describe, expect, it } from "vitest";
import { concluir, etapasAdmin, lerPrimeirosPassos, marcarEtapaVista, type DadosConfiguracao } from "@/lib/primeiros-passos";

const barbeariaNova: DadosConfiguracao = {
  endereco: null,
  cidade: "Não informado",
  totalServicos: 0,
  totalFuncionarios: 1,
};

const feitas = (dados: DadosConfiguracao, vistas: string[] = []) =>
  etapasAdmin(dados, { etapas_vistas: vistas })
    .filter((e) => e.feito)
    .map((e) => e.id);

describe("primeiros passos", () => {
  it("esconde o passo a passo quando a coluna ainda não existe no banco", () => {
    expect(lerPrimeirosPassos(undefined)).toBeNull();
    expect(lerPrimeirosPassos({})).toEqual({ concluido_em: undefined, etapas_vistas: [] });
    expect(lerPrimeirosPassos(null)).toEqual({});
    expect(lerPrimeirosPassos({ concluido_em: "2026-11-27T10:00:00.000Z", etapas_vistas: ["link", 3] })).toEqual({
      concluido_em: "2026-11-27T10:00:00.000Z",
      etapas_vistas: ["link"],
    });
  });

  it("começa sem nenhuma etapa feita numa barbearia recém-cadastrada", () => {
    expect(feitas(barbeariaNova)).toEqual([]);
  });

  it("confere no banco o que dá para conferir e o resto pela visita à tela", () => {
    const configurada = { endereco: "Rua A, 10", cidade: "Recife", totalServicos: 3, totalFuncionarios: 1 };
    expect(feitas(configurada)).toEqual(["perfil", "servicos"]);
    expect(feitas(configurada, ["horarios", "link"])).toEqual(["perfil", "servicos", "horarios", "link"]);
    expect(feitas({ ...configurada, totalFuncionarios: 2 })).toContain("equipe");
  });

  it("não aceita a cidade padrão do cadastro como endereço preenchido", () => {
    expect(feitas({ ...barbeariaNova, endereco: "Rua A, 10" })).not.toContain("perfil");
  });

  it("marca etapa sem duplicar e registra a conclusão", () => {
    const uma = marcarEtapaVista({}, "link");
    expect(marcarEtapaVista(uma, "link")).toBe(uma);
    expect(concluir(uma, new Date("2026-11-27T10:00:00Z"))).toEqual({
      etapas_vistas: ["link"],
      concluido_em: "2026-11-27T10:00:00.000Z",
    });
  });
});
