import { afterEach, describe, expect, it, vi } from "vitest";
import { chaveCidade, cidadeDaLocalizacao, cidadesDisponiveis, correspondeBusca } from "@/lib/localizacao-barbearias";
import { getCityFromCoordinates } from "@/services/geocoding";

const barbearia = {
  nome: "Barbearia Numero 33",
  cidade: "São Paulo",
  bairro: "Jardim Sapopemba",
  endereco: null,
  cep: "03929300",
};

afterEach(() => vi.unstubAllGlobals());

describe("filtro por cidade e CEP", () => {
  it("agrupa variações do município e ignora valores inválidos", () => {
    const cidades = cidadesDisponiveis(["São Paulo", "sao paulo - SP", "1210: 35861"]);
    expect(cidades).toEqual([{ chave: "sao paulo", nome: "São Paulo" }]);
    expect(chaveCidade(" São Paulo (SP) ")).toBe("sao paulo");
    expect(cidadeDaLocalizacao("sao paulo", cidades)?.nome).toBe("São Paulo");
    expect(cidadeDaLocalizacao("Região Metropolitana de São Paulo", cidades)).toBeUndefined();
  });

  it("encontra a barbearia por CEP com ou sem máscara e pelo bairro", () => {
    for (const busca of ["03929300", "03929-300", "sapopemba", "sao paulo", "barbearia número 33"]) {
      expect(correspondeBusca(barbearia, busca)).toBe(true);
    }
    expect(correspondeBusca(barbearia, "03929-301")).toBe(false);
  });

  it("usa o município quando o serviço devolve uma região metropolitana", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({
      city: "Região Metropolitana de São Paulo",
      countryCode: "BR",
      localityInfo: { administrative: [
        { adminLevel: 4, name: "São Paulo" },
        { adminLevel: 7, name: "Região Metropolitana de São Paulo" },
        { adminLevel: 8, name: "São Paulo" },
      ] },
    })));
    expect(await getCityFromCoordinates(-23.6, -46.5)).toEqual({ city: "São Paulo" });
  });

  it("usa o CEP para identificar o município quando só há uma região", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ city: "Região Metropolitana de São Paulo", countryCode: "BR", postcode: "03929-300" }))
      .mockResolvedValueOnce(Response.json({ localidade: "São Paulo", bairro: "Jardim Sapopemba", uf: "SP" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await getCityFromCoordinates(-23.6, -46.5)).toEqual({ city: "São Paulo" });
    expect(fetchMock.mock.calls[1][0]).toBe("https://viacep.com.br/ws/03929300/json/");
  });
});
