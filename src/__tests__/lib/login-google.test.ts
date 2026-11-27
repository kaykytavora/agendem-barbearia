import type { Session } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { erroRetornoGoogle, googleDisponivel, mensagemLoginEquipe, sessaoSocial } from "@/lib/login-google";

function criarSessao(method: string, providerToken?: string) {
  const payload = btoa(JSON.stringify({ amr: [{ method }] }));
  return { access_token: `header.${payload}.signature`, provider_token: providerToken } as Session;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("login de cliente com Google", () => {
  it("identifica uma sessão OAuth renovada e preserva o login da equipe por senha", () => {
    expect(sessaoSocial(criarSessao("oauth"))).toBe(true);
    expect(sessaoSocial(criarSessao("password"))).toBe(false);
    expect(sessaoSocial(criarSessao("oauth", "provider-token"))).toBe(true);
    expect(sessaoSocial(null)).toBe(false);
  });

  it("traduz a restrição de acesso da equipe e o cancelamento pelo cliente", () => {
    expect(erroRetornoGoogle("", "#error=server_error&error_description=LOGIN_EQUIPE_REQUER_SENHA")).toBe(mensagemLoginEquipe);
    expect(erroRetornoGoogle("?error=access_denied", "")).toBe("O login com Google foi cancelado.");
    expect(erroRetornoGoogle("", "")).toBeNull();
  });

  it("mostra o botão apenas quando o Google estiver ativo no projeto", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://projeto.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "chave-publica-teste");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ external: { google: false } }))
      .mockResolvedValueOnce(Response.json({ external: { google: true } }));
    vi.stubGlobal("fetch", fetchMock);
    const { signal } = new AbortController();

    expect(await googleDisponivel(signal)).toBe(false);
    expect(await googleDisponivel(signal)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(new URL("https://projeto.supabase.co/auth/v1/settings"), {
      signal, headers: { apikey: "chave-publica-teste" },
    });
  });
});
