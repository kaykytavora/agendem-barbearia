import { ShieldCheck, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AgendemIcon } from "@/components/AgendemIcon";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useAtualizarNivelMfa, verificarCodigoMfa } from "@/lib/mfa";
import { CodigoMfa } from "./CodigoMfa";
import "./login.css";

/** Segunda etapa do login da equipe: pede o código do app autenticador. */
export function VerificacaoMfa() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const atualizarNivel = useAtualizarNivelMfa();

  return (
    <div className="login-main flex min-h-svh items-center justify-center px-4 py-8">
      <div className="page-enter w-full max-w-md rounded-[1.4rem] border border-border/80 bg-card p-6 shadow-brand-lg sm:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <ShieldCheck className="h-7 w-7 text-primary" aria-hidden="true" />
          </span>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <AgendemIcon className="h-3.5 w-3.5 text-primary" /> Painel da barbearia
          </p>
          <h1 className="text-2xl font-bold">Confirme que é você</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Digite o código de 6 dígitos do seu app autenticador{user?.email ? ` para ${user.email}` : ""}.
          </p>
        </div>

        <CodigoMfa onVerificar={(codigo) => verificarCodigoMfa(codigo)} onSucesso={() => void atualizarNivel()} />

        <Button
          variant="ghost"
          className="mt-4 w-full text-muted-foreground"
          onClick={async () => { await signOut(); navigate("/login"); }}
        >
          <LogOut aria-hidden="true" /> Entrar com outra conta
        </Button>
      </div>
    </div>
  );
}
