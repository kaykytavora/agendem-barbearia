import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS ────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
const geminiUrl =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface Mensagem {
  role: "user" | "model";
  content: string;
}

interface AdvisorRequest {
  mensagem: string;
  cidade?: string;
  lat?: number;
  lng?: number;
  historico?: Mensagem[];
}

interface BarbeariaCard {
  id: string;
  nome: string;
  slug: string;
  cidade: string;
  bairro?: string;
  logo_url?: string;
  telefone?: string;
  nota_media: number;
  total_avaliacoes: number;
  servicos_encontrados: string[]; // serviços que bateram com o pedido
  preco_estimado?: number;
}

// ─── Helper: Gemini via REST (compatível com Deno) ───────────────────────────
async function gerarTextoGemini(apiKey: string, body: object): Promise<string> {
  const resp = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    console.error("Erro da API Gemini", resp.status, await resp.text());
    throw new Error(`Gemini API error ${resp.status}`);
  }

  const json = await resp.json();
  const parts: GeminiPart[] = json.candidates?.[0]?.content?.parts ?? [];
  const texto = parts.filter((part) => !part.thought).map((part) => part.text ?? "").join("").trim();
  if (!texto) throw new Error("Gemini retornou uma resposta sem texto");
  return texto;
}

async function chamarGemini(
  systemPrompt: string,
  historico: Mensagem[],
  mensagemAtual: string,
  apiKey: string
): Promise<string> {
  // Monta o array de "contents" no formato da API Gemini
  const contents = [
    ...historico.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    })),
    {
      role: "user",
      parts: [{ text: mensagemAtual }],
    },
  ];

  return gerarTextoGemini(apiKey, {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { maxOutputTokens: 1024 },
  });
}

// ─── Helper: extrair intenções com Gemini ────────────────────────────────────
async function extrairIntencoes(
  mensagem: string,
  apiKey: string
): Promise<{
  servicos: string[];
  orcamentoMax?: number;
  cidade?: string;
}> {
  const prompt = `
Analise a mensagem de um cliente buscando uma barbearia e extraia as informações em JSON.

Mensagem: "${mensagem}"

Retorne APENAS um JSON válido com esta estrutura (sem markdown, sem explicações):
{
  "servicos": ["lista de serviços mencionados, ex: degradê, barba, corte infantil"],
  "orcamentoMax": 60,
  "cidade": "nome da cidade se mencionada ou null"
}

Se não houver orçamento, use null. Normalize os serviços para minúsculas.
Use "corte" quando o cliente pedir para cortar o cabelo ou disser "barba e cabelo".
`;

  const texto = await gerarTextoGemini(apiKey, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 512, responseMimeType: "application/json" },
  });

  const dados = JSON.parse(texto);
  return {
    servicos: Array.isArray(dados?.servicos)
      ? dados.servicos.filter((s: unknown): s is string => typeof s === "string" && Boolean(s.trim()))
      : [],
    orcamentoMax: typeof dados?.orcamentoMax === "number" ? dados.orcamentoMax : undefined,
    cidade: typeof dados?.cidade === "string" ? dados.cidade.trim() || undefined : undefined,
  };
}

// ─── System Prompt da IA ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
Você é o assistente do agendem, plataforma de agendamento para barbearias e salões no Brasil.

Sua missão: ajudar clientes a encontrar a barbearia ideal de forma rápida e simpática.

REGRAS:
- Responda SEMPRE em português brasileiro, de forma amigável e direta
- Seja conciso: máximo 3 parágrafos curtos por resposta
- Quando tiver barbearias para sugerir, destaque: nome, nota, preço e diferenciais
- Se não houver barbearias compatíveis, peça mais detalhes ou sugira flexibilizar o critério
- Nunca invente dados de barbearias. Use apenas o que veio do banco
- Se o cliente pedir para agendar, diga que pode clicar no cartão da barbearia
- Use emojis com moderação para deixar a conversa mais leve ✂️
`;

// ─── Handler principal ───────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: AdvisorRequest = await req.json();
    const { mensagem, cidade, historico = [] } = body;

    if (!mensagem?.trim()) {
      return new Response(
        JSON.stringify({ error: "mensagem é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1️⃣ Extrair intenções da mensagem do cliente
    const intencoes = await extrairIntencoes(mensagem, apiKey);

    // 2️⃣ Buscar barbearias no banco com os filtros extraídos
    let query = supabase
      .from("barbearias")
      .select(`
        id, nome, slug, cidade, bairro, logo_url, telefone,
        servicos!inner (nome, valor)
      `)
      .is("desativada_em", null)
      .not("servicos.responsavel_id", "is", null)
      .not("slug", "is", null);

    // Filtrar por cidade (da mensagem ou do contexto do cliente)
    const cidadeFiltro = intencoes.cidade ?? cidade;
    if (cidadeFiltro) {
      query = query.ilike("cidade", `%${cidadeFiltro}%`);
    }

    const { data: barbearias, error: dbError } = await query.limit(20);
    if (dbError) throw dbError;

    // 3️⃣ Filtrar e ranquear por serviços + orçamento (client-side após fetch)
    const barbeariasFiltradas: BarbeariaCard[] = (barbearias ?? [])
      .map((b: any) => {
        const servicosB: any[] = b.servicos ?? [];

        // Verificar quais serviços do pedido a barbearia oferece
        const servicosEncontrados = intencoes.servicos.filter((s) =>
          servicosB.some((sb) =>
            sb.nome?.toLowerCase().includes(s.toLowerCase()) ||
            s.toLowerCase().includes(sb.nome?.toLowerCase() ?? "")
          )
        );

        // Verificar orçamento
        const precoEstimado = servicosEncontrados.reduce((acc, s) => {
          const serv = servicosB.find((sb) =>
            sb.nome?.toLowerCase().includes(s.toLowerCase())
          );
          return acc + (serv?.valor ?? 0);
        }, 0);

        const dentroDoBudget =
          !intencoes.orcamentoMax || precoEstimado <= intencoes.orcamentoMax || precoEstimado === 0;

        if (servicosEncontrados.length === 0 && intencoes.servicos.length > 0) {
          return null; // Descarta se não tem nenhum serviço pedido
        }

        return {
          id: b.id,
          nome: b.nome,
          slug: b.slug,
          cidade: b.cidade,
          bairro: b.bairro,
          logo_url: b.logo_url,
          telefone: b.telefone,
          nota_media: b.nota_media ?? 0,
          total_avaliacoes: b.total_avaliacoes ?? 0,
          servicos_encontrados: servicosEncontrados,
          preco_estimado: precoEstimado > 0 ? precoEstimado : undefined,
          _score: servicosEncontrados.length * 10 + (b.nota_media ?? 0) + (dentroDoBudget ? 5 : -5),
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b._score - a._score)
      .slice(0, 5) as BarbeariaCard[];

    // 4️⃣ Montar contexto para a IA gerar a resposta humanizada
    const contexto =
      barbeariasFiltradas.length > 0
        ? `Barbearias encontradas para o cliente:\n${barbeariasFiltradas
            .map(
              (b, i) =>
                `${i + 1}. ${b.nome} — Nota: ${b.nota_media.toFixed(1)}⭐ | Cidade: ${b.cidade}${b.bairro ? `, ${b.bairro}` : ""}${b.preco_estimado ? ` | Preço estimado: R$ ${b.preco_estimado.toFixed(0)}` : ""} | Serviços: ${b.servicos_encontrados.join(", ") || "variados"}`
            )
            .join("\n")}`
        : "Nenhuma barbearia encontrada com esses critérios na base de dados.";

    const mensagemComContexto = `${mensagem}\n\n[Contexto do sistema]\n${contexto}`;

    // 5️⃣ Gerar resposta da IA
    const respostaIA = await chamarGemini(
      SYSTEM_PROMPT,
      historico,
      mensagemComContexto,
      apiKey
    );

    return new Response(
      JSON.stringify({
        texto: respostaIA,
        barbearias: barbeariasFiltradas,
        intencoes,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Erro no advisor:", err);
    return new Response(
      JSON.stringify({ error: "Não foi possível consultar as barbearias." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
