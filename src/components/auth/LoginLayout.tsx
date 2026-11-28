import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, MapPin, Store, UserRound } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { AgendemIcon } from "@/components/AgendemIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import "./login.css";

const conteudo = {
  cliente: {
    imagem: "/login-cliente.jpg",
    chamada: "Agende com facilidade.",
    detalhe: "Encontre sua barbearia, escolha um horário e reserve seu próximo corte.",
    recurso: "Horários em tempo real",
    titulo: "Bem-vindo de volta.",
    descricao: "Acesse sua conta para agendar e acompanhar seus horários.",
    cadastro: "/register",
    textoCadastro: "Cadastre-se",
    outroAcesso: "/login",
    textoOutroAcesso: "Acessar como barbearia",
    iconeOutroAcesso: Store,
  },
  barbearia: {
    imagem: "/login-barbearia.jpg",
    chamada: "Gestão simples para sua barbearia.",
    detalhe: "Organize a agenda, atenda seus clientes e gerencie sua equipe em um só lugar.",
    titulo: "Seu espaço de gestão.",
    descricao: "Entre no painel da sua barbearia.",
    cadastro: "/register-barbershop",
    textoCadastro: "Cadastre sua barbearia",
    outroAcesso: "/client-login",
    textoOutroAcesso: "Acessar como cliente",
    iconeOutroAcesso: UserRound,
  },
} as const;

const recuperacaoConteudo = {
  solicitar: {
    titulo: "Recupere sua senha.",
    descricao: "Informe o e-mail da sua conta para receber as instruções de recuperação.",
  },
  redefinir: {
    titulo: "Crie uma nova senha.",
    descricao: "Abra o link enviado para o seu e-mail ou digite o código de seis dígitos.",
  },
};

function Marca({ profissional = false }: { profissional?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <AgendemIcon className="size-7 text-primary lg:size-8" />
      <span className="text-2xl font-bold leading-none tracking-[-0.06em] sm:text-[1.75rem]">
        agendem<span className="text-primary">.</span>
      </span>
      {profissional && (
        <span className="rounded-md bg-accent px-2 py-1 text-xs font-semibold leading-none text-accent-foreground">
          Pro
        </span>
      )}
    </span>
  );
}

type FaseLamina = "parada" | "cobrindo" | "revelando";

/** Seletor "Cliente | Barbearia" com destaque deslizante. */
function SeletorAcesso({ acesso, onTrocar }: { acesso: keyof typeof conteudo; onTrocar: (destino: keyof typeof conteudo) => void }) {
  const opcoes = [
    { id: "cliente" as const, rotulo: "Cliente", Icone: UserRound },
    { id: "barbearia" as const, rotulo: "Barbearia", Icone: Store },
  ];
  return (
    <div role="tablist" aria-label="Tipo de acesso" className="relative grid grid-cols-2 rounded-xl bg-muted p-1">
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-card shadow-brand-sm transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ transform: acesso === "barbearia" ? "translateX(100%)" : "translateX(0)" }}
      />
      {opcoes.map(({ id, rotulo, Icone }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={acesso === id}
          onClick={() => acesso !== id && onTrocar(id)}
          className={cn(
            "relative z-10 flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            acesso === id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icone aria-hidden="true" className="h-4 w-4" />
          {rotulo}
        </button>
      ))}
    </div>
  );
}

interface LoginLayoutProps {
  acesso: keyof typeof conteudo;
  recuperacao?: keyof typeof recuperacaoConteudo;
  children: ReactNode;
}

export function LoginLayout({ acesso, recuperacao, children }: LoginLayoutProps) {
  const info = conteudo[acesso];
  const profissional = acesso === "barbearia";
  const cabecalho = recuperacao ? recuperacaoConteudo[recuperacao] : info;
  const permiteNavegar = !profissional && !recuperacao;
  const voltar = recuperacao && profissional ? "/login" : "/client-login";
  const navigate = useNavigate();
  const location = useLocation();
  // Chegando pela troca de acesso, a lâmina começa cobrindo o card e termina de passar
  const [lamina, setLamina] = useState<FaseLamina>(() => (location.state as { lamina?: boolean } | null)?.lamina ? "revelando" : "parada");

  useEffect(() => {
    if (lamina !== "revelando") return;
    const id = window.setTimeout(() => setLamina("parada"), 1150);
    return () => window.clearTimeout(id);
  }, [lamina]);

  function trocarAcesso(destino: keyof typeof conteudo) {
    const rota = destino === "barbearia" ? "/login" : "/client-login";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      navigate(rota);
      return;
    }
    setLamina("cobrindo");
    window.setTimeout(() => navigate(rota, { state: { lamina: true } }), 650);
  }

  return (
    <div className="grid min-h-svh grid-cols-1 bg-background text-foreground lg:grid-cols-2">
      <aside
        data-lamina={lamina === "parada" ? undefined : lamina}
        className="login-hero relative isolate hidden overflow-hidden text-[#fafaf9] lg:flex lg:items-center"
        style={{ backgroundImage: `linear-gradient(90deg, #122a22f2 0%, #142e24c9 42%, #192d2759 100%), url(${info.imagem})` }}
      >
        <div className="login-hero-texto relative w-full max-w-[38rem] px-[clamp(2.5rem,6vw,6rem)] py-12">
          <Marca profissional={profissional} />
          <div className="mt-14">
            <div aria-hidden="true" className="mb-5 h-1 w-8 rounded-full bg-[#a4ddbf]" />
            <h2 className="max-w-sm text-pretty text-4xl font-bold leading-[1.08] tracking-[-0.045em] xl:text-5xl">
              {info.chamada}
            </h2>
            <p className="mt-4 max-w-[25rem] text-pretty text-base leading-relaxed text-[#dce7df] xl:text-lg">
              {info.detalhe}
            </p>
            {"recurso" in info && (
              <p className="mt-7 flex items-center gap-2.5 text-sm font-medium text-[#dce7df]">
                <Check aria-hidden="true" className="h-7 w-7 rounded-lg bg-white/10 p-1.5 text-[#a4ddbf]" />
                {info.recurso}
              </p>
            )}
          </div>
        </div>
      </aside>

      <main
        data-lamina={lamina === "parada" ? undefined : lamina}
        style={{ ["--login-imagem" as string]: `url(${info.imagem})` }}
        className={`login-main grid min-w-0 grid-cols-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-3 ${!recuperacao ? "grid-rows-1" : "grid-rows-[auto_1fr]"}`}
      >
        {recuperacao && (
          <div className="mx-auto w-full max-w-[29rem] lg:max-w-none">
            <Link
              to={voltar}
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-sm font-medium text-[#dce7df] transition-colors hover:text-white lg:text-muted-foreground lg:hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Voltar ao login
            </Link>
          </div>
        )}
        <div className="mx-auto flex w-full max-w-[29rem] items-center">
          <Card variant="glass" data-lamina={lamina === "parada" ? undefined : lamina}
            className={cn("login-card relative w-full min-w-0 overflow-hidden rounded-[1.4rem] border-border/80 shadow-brand-lg", lamina === "parada" && !location.state && "page-enter")}>
            {lamina !== "parada" && <span aria-hidden="true" className="login-lamina" data-fase={lamina} />}
            <CardHeader className="gap-3 space-y-0 p-4 sm:p-6 sm:pb-4">
              <Marca profissional={profissional} />
              {!recuperacao && <SeletorAcesso acesso={acesso} onTrocar={trocarAcesso} />}
              <div>
                <h1 className="text-pretty text-[1.65rem] font-bold leading-tight tracking-[-0.045em] sm:text-3xl">
                  {cabecalho.titulo}
                </h1>
                <CardDescription className="mt-1.5 text-pretty leading-relaxed">{cabecalho.descricao}</CardDescription>
                {permiteNavegar && (
                  <Button asChild variant="outline" className="depth-hover mt-3 min-h-11 w-full justify-start rounded-lg bg-background/55 px-3">
                    <Link to="/barbearias">
                      <MapPin aria-hidden="true" className="text-primary" />
                      Navegar sem conta
                      <ArrowRight aria-hidden="true" className="ml-auto text-primary" />
                    </Link>
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
              {children}
              {!recuperacao && (
                <>
                  <p className="text-center text-sm text-muted-foreground">
                    Ainda não tem conta?{" "}
                    <Link className="font-semibold text-primary underline-offset-4 hover:underline" to={info.cadastro}>
                      {info.textoCadastro}
                    </Link>
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
