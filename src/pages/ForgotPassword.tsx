import { useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Mail } from "lucide-react";
import { LoginLayout } from "@/components/auth/LoginLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";

export default function ForgotPassword() {
  const { state } = useLocation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const cliente = params.get("acesso") === "cliente";
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState(typeof state?.email === "string" ? state.email : "");
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  function solicitar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando) return;
    setEmail(email.trim());
    setErro(null);
    setConfirmar(true);
  }

  async function enviarCodigo() {
    setEnviando(true);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        setErro("Não foi possível enviar o código. Confira o e-mail e tente novamente.");
        return;
      }
      navigate(cliente ? "/reset-password?acesso=cliente" : "/reset-password", { state: { email } });
    } catch {
      setErro("Não foi possível enviar o código. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <LoginLayout acesso={cliente ? "cliente" : "barbearia"} recuperacao="solicitar">
      <form onSubmit={solicitar} aria-busy={enviando} className="space-y-4">
        {erro && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{erro}</p>}
        <div className="space-y-1.5">
          <Label htmlFor="email">{cliente ? "E-mail" : "E-mail profissional"}</Label>
          <div className="relative">
            <Mail aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="Digite seu e-mail"
              className="h-11 rounded-lg bg-background/65 pl-9"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={enviando}
              required
            />
          </div>
        </div>
        <Button ref={submitRef} type="submit" disabled={enviando} className="h-11 w-full rounded-lg">
          {enviando && <Loader2 aria-hidden="true" className="animate-spin" />}
          {enviando ? "Enviando..." : "Enviar instruções"}
        </Button>
      </form>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent
          className="rounded-2xl text-foreground"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            submitRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Confirme seu e-mail</AlertDialogTitle>
            <AlertDialogDescription>
              Enviaremos o código de recuperação para <strong className="font-semibold text-foreground [overflow-wrap:anywhere]">{email}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void enviarCodigo()}>Sim, enviar código</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LoginLayout>
  );
}
