import type { AuthError } from "@supabase/supabase-js";

/**
 * Mensagem para quem errou o login. O 400 que aparece no console do navegador nesses casos é o
 * próprio navegador registrando a resposta do Supabase; não dá para (nem precisa) escondê-lo.
 */
export function mensagemErroLogin(erro: { message: string; status?: number; code?: string }): string {
  // signIn devolve o AuthError do Supabase tipado como Error; status e code vêm junto
  const error = erro as Partial<Pick<AuthError, "status" | "code">> & { message: string };
  const code = error.code ?? "";
  const message = error.message ?? "";

  if (code === "invalid_credentials" || message === "Invalid login credentials") {
    return "E-mail ou senha incorretos.";
  }
  if (code === "email_not_confirmed" || message === "Email not confirmed") {
    return "Confirme seu e-mail antes de entrar. Procure a mensagem de confirmação na sua caixa de entrada.";
  }
  if (error.status === 429 || code.startsWith("over_")) {
    return "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.";
  }
  if (!error.status) {
    return "Sem conexão com o servidor. Verifique sua internet e tente de novo.";
  }
  return "Não foi possível entrar agora. Tente novamente.";
}
