function normalizarBusca(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function chaveCidade(cidade: string | null) {
  return normalizarBusca((cidade ?? "").replace(/\s*(?:[-–/,]\s*[a-z]{2}|\([a-z]{2}\))\s*$/i, ""));
}

export function cidadeUtil(cidade: string | null): boolean {
  const chave = chaveCidade(cidade);
  return /\p{L}/u.test(chave) && !/\d/.test(chave) &&
    !/^(?:regiao|microrregiao|mesorregiao|estado|nao informad[oa]|nao definid[oa]|sem cidade)\b/.test(chave);
}

export function cidadesDisponiveis(cidades: string[]) {
  const opcoes = new Map<string, string>();
  for (const cidade of cidades) {
    if (cidadeUtil(cidade)) {
      const chave = chaveCidade(cidade);
      if (!opcoes.has(chave)) opcoes.set(chave, cidade.trim());
    }
  }
  return [...opcoes].map(([chave, nome]) => ({ chave, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** "Jardim Sapopemba - São Paulo"; cai para o que existir */
export function rotuloLocal(bairro: string | null, cidade: string | null) {
  return [bairro?.trim(), cidade?.trim()].filter(Boolean).join(" - ");
}

export interface RegiaoCliente { bairro?: string | null; cidade?: string | null }

/** 0 = mesmo bairro e cidade, 1 = mesma cidade, 2 = outra região */
export function proximidadeRegiao(barbearia: { bairro: string | null; cidade: string }, regiao: RegiaoCliente | null) {
  if (!regiao?.cidade || chaveCidade(barbearia.cidade) !== chaveCidade(regiao.cidade)) return 2;
  return regiao.bairro && normalizarBusca(barbearia.bairro ?? "") === normalizarBusca(regiao.bairro) ? 0 : 1;
}

export function cidadeDaLocalizacao(cidade: string | null, opcoes: ReturnType<typeof cidadesDisponiveis>) {
  return cidadeUtil(cidade) ? opcoes.find((opcao) => opcao.chave === chaveCidade(cidade)) : undefined;
}

export function correspondeBusca(barbearia: {
  nome: string;
  cidade: string;
  bairro: string | null;
  endereco: string | null;
  cep: string | null;
}, busca: string) {
  const consulta = busca.trim();
  if (/^[\d\s-]+$/.test(consulta)) {
    const digitos = consulta.replace(/\D/g, "");
    if (digitos.length === 8) return barbearia.cep?.replace(/\D/g, "") === digitos;
    if (digitos.length >= 3 && digitos.length < 8 && barbearia.cep?.replace(/\D/g, "").startsWith(digitos)) return true;
  }

  const termos = normalizarBusca(consulta);
  const endereco = normalizarBusca([barbearia.endereco, barbearia.bairro, barbearia.cidade].join(" "));
  return normalizarBusca(barbearia.nome).includes(termos) || endereco.includes(termos);
}
