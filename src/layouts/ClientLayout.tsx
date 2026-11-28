import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { CalendarDays, HelpCircle, Home, LogOut, Search, Settings, type LucideIcon } from "lucide-react";
import { AgendemIcon } from "@/components/AgendemIcon";
import { PillDeslizante } from "@/components/PillDeslizante";
import { AIAssistantButton } from "@/components/ai/AIAssistantButton";
import { DockNavegacao, type GrupoDock } from "@/components/DockNavegacao";
import { EVENTO_ABRIR_ASSISTENTE_CLIENTE } from "@/lib/eventos";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface ItemNav {
  to: string;
  label: string;
  /** Rótulo curto da barra inferior no celular */
  curto: string;
  icon: LucideIcon;
}

const ITENS: ItemNav[] = [
  { to: "/client-panel", label: "Início", curto: "Início", icon: Home },
  { to: "/barbearias", label: "Encontrar barbearias", curto: "Agendar", icon: Search },
  { to: "/meus-agendamentos", label: "Meus agendamentos", curto: "Agenda", icon: CalendarDays },
  { to: "/client-settings", label: "Configurações", curto: "Conta", icon: Settings },
];

interface ClientLayoutProps {
  children: ReactNode;
  /** Abre o tour "Como funciona" (mostrado só quando informado) */
  onAjuda?: () => void;
}

/** Estrutura das telas do cliente logado: navegação lateral no desktop e barra inferior no celular. */
export function ClientLayout({ children, onAjuda }: ClientLayoutProps) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const nome = profile?.name || user?.user_metadata?.name || "Cliente";

  const gruposDock: GrupoDock[] = [
    { titulo: "Navegar", itens: ITENS.map(({ to, label, icon }) => ({ title: label, url: to, icon })) },
    ...(onAjuda ? [{ titulo: "Ajuda", itens: [{ title: "Como funciona", icon: HelpCircle, onClick: onAjuda }] }] : []),
  ];

  const sair = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-bg">
      {/* Navegação lateral (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border/60 bg-card/70 backdrop-blur-md lg:flex">
        <div className="flex items-center gap-2.5 px-6 py-6">
          <AgendemIcon className="h-7 w-7 text-primary" />
          <span className="font-display text-lg font-bold tracking-tight">Agendem</span>
        </div>

        <nav aria-label="Navegação do cliente" className="flex-1 px-3">
          <PillDeslizante id="cliente" className="space-y-1">
          {ITENS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-500",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive ? "text-primary-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
          {onAjuda && (
            <button
              type="button"
              onClick={onAjuda}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <HelpCircle className="h-4 w-4" aria-hidden="true" />
              Como funciona
            </button>
          )}
          </PillDeslizante>
        </nav>

        <div className="space-y-3 border-t border-border/60 p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={user?.user_metadata?.avatar_url} alt="" />
              <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">{nome.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{nome}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <ThemeToggle />
          </div>
          <button
            type="button"
            onClick={sair}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sair
          </button>
        </div>
      </aside>

      {/* Topo (celular) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-2">
          <AgendemIcon className="h-6 w-6 text-primary" />
          <span className="font-display font-bold">Agendem</span>
        </div>
        <div className="flex items-center gap-1">
          {onAjuda && (
            <button type="button" onClick={onAjuda} aria-label="Como funciona"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
              <HelpCircle className="h-4 w-4" />
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="pb-28 lg:pb-0 lg:pl-64">{children}</main>

      {/* No celular o assistente abre pelo dock; o botão flutuante só aparece no desktop */}
      <AIAssistantButton className="bottom-24 lg:bottom-6" classeBotao="hidden lg:inline-flex" />

      {/* Dock (celular) */}
      <DockNavegacao
        rotulo="Navegação do cliente"
        id="cliente"
        ocultarEm="lg:hidden"
        principais={ITENS.slice(0, 3).map(({ to, curto, icon }) => ({ title: curto, url: to, icon }))}
        grupos={gruposDock}
        onAssistente={() => window.dispatchEvent(new Event(EVENTO_ABRIR_ASSISTENTE_CLIENTE))}
        onSair={sair}
      />
    </div>
  );
}
