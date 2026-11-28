import { useState, type FormEvent, type ReactNode } from "react";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { mensagemErroLogin } from "@/lib/auth-errors";

interface LoginFormProps {
  profissional?: boolean;
  disabled?: boolean;
  alternativa?: (enviando: boolean) => ReactNode;
}

export function LoginForm({ profissional = false, disabled = false, alternativa }: LoginFormProps) {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const bloqueado = disabled || enviando;

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (bloqueado) return;
    const dados = new FormData(event.currentTarget);
    setErro(null);
    setEnviando(true);
    try {
      const { error } = await signIn(String(dados.get("email")).trim(), String(dados.get("password")));
      if (error) {
        setErro(mensagemErroLogin(error));
        return;
      }
      toast({ title: "Login realizado!", description: "Bem-vindo de volta." });
    } catch {
      setErro("Não foi possível entrar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-2">
      <form onSubmit={enviar} aria-busy={enviando} className="space-y-2.5">
        {erro && (
          <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            {erro}
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="email">{profissional ? "E-mail profissional" : "E-mail"}</Label>
          <div className="relative">
            <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder={profissional ? "Digite seu e-mail profissional" : "Digite seu e-mail"}
              className="h-11 rounded-lg bg-background/65 pl-9"
              disabled={bloqueado}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <div className="relative col-span-2 row-start-2">
            <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              name="password"
              type={mostrarSenha ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Digite sua senha"
              className="h-11 rounded-lg bg-background/65 pl-9 pr-12"
              disabled={bloqueado}
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              aria-controls="password"
              onClick={() => setMostrarSenha((visivel) => !visivel)}
              className="absolute inset-y-0 right-0 h-11 w-11 rounded-lg text-muted-foreground"
            >
              {mostrarSenha ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </div>
          <Link
            to={profissional ? "/forgot-password" : "/forgot-password?acesso=cliente"}
            className="col-start-2 row-start-1 inline-flex min-h-8 items-center justify-self-end rounded text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Esqueci minha senha
          </Link>
        </div>
        <Button type="submit" disabled={bloqueado} className="h-11 w-full rounded-lg">
          {enviando && <Loader2 aria-hidden="true" className="animate-spin" />}
          {enviando ? "Entrando..." : profissional ? "Acessar painel" : "Entrar"}
        </Button>
      </form>
      {alternativa?.(enviando)}
    </div>
  );
}
