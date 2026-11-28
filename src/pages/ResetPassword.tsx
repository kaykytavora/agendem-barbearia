import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { LoginLayout } from "@/components/auth/LoginLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const campo = "h-11 rounded-lg bg-background/65";

export default function ResetPassword() {
  const { state } = useLocation();
  const [params] = useSearchParams();
  const cliente = params.get("acesso") === "cliente";
  const login = cliente ? "/client-login" : "/login";
  const recuperar = cliente ? "/forgot-password?acesso=cliente" : "/forgot-password";
  const navigate = useNavigate();
  const { verifyCodeAndUpdatePassword } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState(typeof state?.email === "string" ? state.email : "");
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function redefinir(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando || codigo.length !== 6) return;
    const dados = new FormData(event.currentTarget);
    const senha = String(dados.get("password"));
    if (senha !== dados.get("confirmPassword")) {
      setErro("As senhas não coincidem.");
      return;
    }

    setErro(null);
    setEnviando(true);
    try {
      const { error } = await verifyCodeAndUpdatePassword(email.trim(), codigo, senha);
      if (error) {
        setErro(error.message || "Não foi possível redefinir a senha. Verifique o código.");
        return;
      }
      toast({ title: "Senha redefinida com sucesso." });
      navigate(login, { replace: true });
    } catch {
      setErro("Não foi possível redefinir a senha. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <LoginLayout acesso={cliente ? "cliente" : "barbearia"} recuperacao="redefinir">
      <form onSubmit={redefinir} aria-busy={enviando} className="space-y-4">
        {erro && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{erro}</p>}
        <div className="space-y-1.5">
          <Label htmlFor="email">{cliente ? "E-mail" : "E-mail profissional"}</Label>
          <Input id="email" type="email" autoComplete="email" className={campo} value={email}
            onChange={(event) => setEmail(event.target.value)} disabled={enviando} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="code">Código de verificação</Label>
          <InputOTP id="code" maxLength={6} pattern={REGEXP_ONLY_DIGITS} inputMode="numeric" autoComplete="one-time-code"
            containerClassName="w-full min-w-0"
            value={codigo} onChange={setCodigo} disabled={enviando} required>
            <InputOTPGroup className="w-full max-w-[19rem] gap-1.5 sm:gap-2">
              {Array.from({ length: 6 }, (_, index) => (
                <InputOTPSlot key={index} index={index} className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-background/65 text-lg font-medium tabular-nums" />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Nova senha</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={6}
            aria-describedby="senha-requisitos" className={campo} disabled={enviando} required />
          <p id="senha-requisitos" className="text-xs text-muted-foreground">Use pelo menos seis caracteres.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirmar senha</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password"
            minLength={6} className={campo} disabled={enviando} required />
        </div>

        <Button type="submit" disabled={enviando || codigo.length !== 6} className="h-11 w-full rounded-lg">
          {enviando && <Loader2 aria-hidden="true" className="animate-spin" />}
          {enviando ? "Redefinindo..." : "Redefinir senha"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Não recebeu o código?{" "}
        <Link to={recuperar} state={{ email }} replace className="font-semibold text-primary underline-offset-4 hover:underline">
          Solicitar novo código
        </Link>
      </p>
    </LoginLayout>
  );
}
