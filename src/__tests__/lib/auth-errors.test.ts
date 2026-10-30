import { mensagemErroLogin } from "@/lib/auth-errors";

describe("mensagemErroLogin", () => {
  it("separa senha errada, e-mail não confirmado, excesso de tentativas e falta de conexão", () => {
    expect(mensagemErroLogin({ message: "Invalid login credentials", status: 400, code: "invalid_credentials" })).toBe("E-mail ou senha incorretos.");
    expect(mensagemErroLogin({ message: "Email not confirmed", status: 400, code: "email_not_confirmed" })).toMatch(/Confirme seu e-mail/);
    expect(mensagemErroLogin({ message: "Request rate limit reached", status: 429, code: "over_request_rate_limit" })).toMatch(/Muitas tentativas/);
    expect(mensagemErroLogin({ message: "Failed to fetch", status: 0 })).toMatch(/Sem conexão/);
    expect(mensagemErroLogin({ message: "Database error", status: 500 })).toBe("Não foi possível entrar agora. Tente novamente.");
  });
});
