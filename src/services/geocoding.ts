import { cidadeUtil } from "@/lib/localizacao-barbearias";
import { consultarCep } from "@/services/cep";

interface GeocodingResult {
  city: string | null;
  error?: string;
}

interface BigDataCloudResponse {
  city?: string;
  countryCode?: string;
  postcode?: string;
  localityInfo?: { administrative?: { name: string; adminLevel?: number }[] };
}

interface NominatimResponse {
  address?: { city?: string; town?: string; village?: string; municipality?: string };
}

function primeiraCidade(...nomes: (string | undefined)[]) {
  return nomes.find((nome) => cidadeUtil(nome ?? null)) ?? null;
}

export async function getCityFromCoordinates(latitude: number, longitude: number): Promise<GeocodingResult> {
  const ponto = { lat: String(latitude), lon: String(longitude) };
  try {
    const parametros = new URLSearchParams({
      latitude: ponto.lat, longitude: ponto.lon, localityLanguage: "pt",
    });
    const resposta = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${parametros}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (resposta.ok) {
      const dados: BigDataCloudResponse = await resposta.json();
      const noBrasil = dados.countryCode === "BR";
      const municipio = noBrasil
        ? dados.localityInfo?.administrative?.find((item) => item.adminLevel === 8)?.name
        : undefined;
      const city = primeiraCidade(municipio, dados.city);
      if (city) return { city };
      if (noBrasil) {
        const endereco = await consultarCep(dados.postcode ?? null).catch(() => null);
        if (endereco) return { city: endereco.localidade };
      }
    }
  } catch {
    // Tenta o serviço alternativo quando a primeira consulta está indisponível.
  }

  try {
    const parametros = new URLSearchParams({
      ...ponto, format: "jsonv2", zoom: "12", addressdetails: "1", "accept-language": "pt-BR,pt",
    });
    const resposta = await fetch(`https://nominatim.openstreetmap.org/reverse?${parametros}`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (resposta.ok) {
      const { address }: NominatimResponse = await resposta.json();
      const city = primeiraCidade(address?.municipality, address?.city, address?.town, address?.village);
      if (city) return { city };
    }
  } catch {
    // A vitrine continua disponível quando a cidade não pode ser identificada.
  }

  return { city: null, error: "Não foi possível identificar sua cidade." };
}
