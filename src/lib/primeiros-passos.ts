import type { Json } from "@/integrations/supabase/types";

/** Conteúdo da coluna profiles.primeiros_passos (type, e não interface, para caber em Json) */
export type PrimeirosPassos = {
  concluido_em?: string;
  etapas_vistas?: string[];
};

/**
 * Lê a coluna do perfil. Retorna null quando a coluna ainda não existe no banco
 * (migration 012 não aplicada): nesse caso o passo a passo fica escondido, porque
 * não haveria onde salvar o andamento e ele reapareceria a cada acesso.
 */
export function lerPrimeirosPassos(valor: Json | undefined): PrimeirosPassos | null {
  if (valor === undefined) return null;
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};

  const concluido = typeof valor.concluido_em === "string" ? valor.concluido_em : undefined;
  const vistas = Array.isArray(valor.etapas_vistas)
    ? valor.etapas_vistas.filter((e): e is string => typeof e === "string")
    : [];
  return { concluido_em: concluido, etapas_vistas: vistas };
}

export function marcarEtapaVista(estado: PrimeirosPassos, etapa: string): PrimeirosPassos {
  const vistas = estado.etapas_vistas ?? [];
  return vistas.includes(etapa) ? estado : { ...estado, etapas_vistas: [...vistas, etapa] };
}

export function concluir(estado: PrimeirosPassos, agora = new Date()): PrimeirosPassos {
  return { ...estado, concluido_em: agora.toISOString() };
}

// -----------------------------------------------------------------------------
// Checklist do admin
// -----------------------------------------------------------------------------

export interface DadosConfiguracao {
  endereco: string | null;
  cidade: string | null;
  totalServicos: number;
  totalFuncionarios: number;
}

export type IdEtapaAdmin = "perfil" | "servicos" | "horarios" | "equipe" | "link";

export interface EtapaAdmin {
  id: IdEtapaAdmin;
  titulo: string;
  descricao: string;
  destino: string;
  feito: boolean;
}

/** Cidade que o cadastro preenche sozinho enquanto o dono não informa a real */
const CIDADE_PADRAO = "Não informado";

export function etapasAdmin(dados: DadosConfiguracao, estado: PrimeirosPassos): EtapaAdmin[] {
  const vistas = new Set(estado.etapas_vistas ?? []);
  const cidade = dados.cidade?.trim() ?? "";

  return [
    {
      id: "perfil",
      titulo: "Complete os dados da barbearia",
      descricao: "Endereço e cidade, para os clientes encontrarem você na busca.",
      destino: "/dashboard/settings",
      feito: !!dados.endereco?.trim() && !!cidade && cidade !== CIDADE_PADRAO,
    },
    {
      id: "servicos",
      titulo: "Cadastre seus serviços",
      descricao: "Sem serviços, ninguém consegue agendar pela sua página.",
      destino: "/dashboard/servicos",
      feito: dados.totalServicos > 0,
    },
    {
      id: "horarios",
      titulo: "Confira os horários de funcionamento",
      descricao: "Já deixamos um horário padrão. Ajuste para o seu dia a dia.",
      destino: "/dashboard/settings?aba=hours",
      feito: vistas.has("horarios"),
    },
    {
      id: "equipe",
      titulo: "Adicione sua equipe",
      descricao: "Cada profissional ganha a própria agenda. Trabalha sozinho? Pode pular.",
      destino: "/dashboard/funcionarios",
      feito: dados.totalFuncionarios > 1 || vistas.has("equipe"),
    },
    {
      id: "link",
      titulo: "Compartilhe seu link de agendamento",
      descricao: "Mande no WhatsApp e no Instagram para receber os primeiros horários.",
      destino: "/dashboard/share-profile",
      feito: vistas.has("link"),
    },
  ];
}

/** Etapas que só contam como feitas depois que o dono abre a tela correspondente */
export const ETAPAS_POR_VISITA: ReadonlySet<IdEtapaAdmin> = new Set(["horarios", "equipe", "link"]);
