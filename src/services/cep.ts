interface EnderecoCep {
  localidade: string;
  logradouro: string;
  bairro: string;
  uf: string;
}

export async function consultarCep(cep: string | null): Promise<EnderecoCep | null> {
  const digitos = cep?.replace(/\D/g, "");
  if (!digitos || digitos.length !== 8) return null;

  const response = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, {
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) return null;
  const dados: Partial<EnderecoCep> & { erro?: boolean | string } = await response.json();
  if (dados.erro || !dados.localidade) return null;
  return {
    localidade: dados.localidade,
    logradouro: dados.logradouro ?? "",
    bairro: dados.bairro ?? "",
    uf: dados.uf ?? "",
  };
}
