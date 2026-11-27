import type { Session } from "@supabase/supabase-js";

export const mensagemLoginEquipe = "Para acessar o painel da barbearia, entre com e-mail e senha.";

export function sessaoSocial(session: Session | null): boolean {
  if (!session) return false;
  if (session.provider_token) return true;

  try {
    const payload = session.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims: { amr?: { method?: string }[] } = JSON.parse(atob(payload));
    return claims.amr?.some((entrada) => entrada.method === "oauth") ?? false;
  } catch {
    return false;
  }
}

export function erroRetornoGoogle(search: string, hash: string) {
  const parametros = new URLSearchParams(search);
  const fragmento = new URLSearchParams(hash.slice(1));
  const erro = parametros.get("error") ?? fragmento.get("error");
  const codigo = parametros.get("error_code") ?? fragmento.get("error_code");
  const detalhe = parametros.get("error_description") ?? fragmento.get("error_description") ?? "";
  if (detalhe.includes("LOGIN_EQUIPE_REQUER_SENHA")) return mensagemLoginEquipe;
  if (erro === "access_denied" && (!codigo || codigo === "access_denied")) return "O login com Google foi cancelado.";
  return erro || codigo ? "Não foi possível concluir o login com Google. Tente novamente." : null;
}

export async function googleDisponivel(signal: AbortSignal) {
  const endpoint = new URL("/auth/v1/settings", import.meta.env.VITE_SUPABASE_URL);
  const resposta = await fetch(endpoint, {
    signal,
    headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
  });
  if (!resposta.ok) throw new Error("Não foi possível consultar os métodos de login.");
  const dados: { external?: { google?: boolean } } = await resposta.json();
  return dados.external?.google === true;
}
