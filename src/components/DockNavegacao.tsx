import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LayoutGrid, LogOut, Search, Sparkles, X, type LucideIcon } from "lucide-react";
import { PillDeslizante } from "@/components/PillDeslizante";
import { cn } from "@/lib/utils";

export interface AtalhoDock {
  title: string;
  url: string;
  icon: LucideIcon;
}

export interface AcaoDock {
  title: string;
  icon: LucideIcon;
  onClick: () => void;
}

export interface GrupoDock {
  titulo: string;
  itens: (AtalhoDock | AcaoDock)[];
}

interface DockNavegacaoProps {
  /** Rótulo para leitores de tela */
  rotulo: string;
  /** Chave para o destaque lembrar a posição entre páginas */
  id: string;
  /** Até 3 atalhos fixos na barra */
  principais: AtalhoDock[];
  /** Tudo o que aparece no painel da grade */
  grupos: GrupoDock[];
  onAssistente: () => void;
  onSair: () => void;
  /** Conteúdo extra no rodapé do painel (ex.: botão de tema) */
  rodape?: ReactNode;
  /** Classe que esconde o dock nas telas grandes */
  ocultarEm?: string;
}

const semAcento = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const ehLink = (item: AtalhoDock | AcaoDock): item is AtalhoDock => "url" in item;

/**
 * Navegação no celular: dock flutuante com atalhos, um botão de grade que abre todas as
 * páginas agrupadas (com busca) e o assistente de IA na ponta. Um destaque escorre entre
 * os itens da barra, como no menu lateral.
 */
export function DockNavegacao({ rotulo, id, principais, grupos, onAssistente, onSair, rodape, ocultarEm = "md:hidden" }: DockNavegacaoProps) {
  const location = useLocation();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const campoBusca = useRef<HTMLInputElement>(null);

  const filtrados = useMemo(() => {
    const termo = semAcento(busca.trim());
    if (!termo) return grupos;
    return grupos
      .map((g) => ({ ...g, itens: g.itens.filter((i) => semAcento(i.title).includes(termo)) }))
      .filter((g) => g.itens.length > 0);
  }, [grupos, busca]);

  // Fecha ao trocar de página e com Esc
  useEffect(() => { setAberto(false); }, [location.pathname]);
  useEffect(() => {
    if (!aberto) { setBusca(""); return; }
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberto]);

  const ativoPrincipal = principais.find(({ url }) => url === location.pathname)?.url;
  // O destaque vai para a grade quando o painel está aberto ou a página atual não está na barra
  const gradeAtiva = aberto || !ativoPrincipal;
  let indice = 0;

  const fechar = () => setAberto(false);

  return (
    <div className={ocultarEm}>
      <div
        aria-hidden="true"
        onClick={fechar}
        className={cn(
          "fixed inset-0 z-40 bg-background/60 backdrop-blur-sm transition-opacity duration-300",
          aberto ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Painel com todas as páginas */}
      <div
        id={`${id}-paginas`}
        role="dialog"
        aria-label="Todas as páginas"
        aria-hidden={!aberto}
        className={cn(
          "fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-50 max-h-[70svh] origin-bottom overflow-y-auto overscroll-contain rounded-3xl border border-border/60 bg-card/95 p-4 shadow-2xl backdrop-blur-xl",
          "transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          aberto ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-4 scale-95 opacity-0",
        )}
      >
        <label className="mb-4 flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">Ir para uma página</span>
          <input
            ref={campoBusca}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Ir para..."
            tabIndex={aberto ? 0 : -1}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>

        {filtrados.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma página encontrada.</p>
        ) : filtrados.map((grupo) => (
          <section key={grupo.titulo} className="mb-4 last:mb-0">
            <h2 className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{grupo.titulo}</h2>
            <ul className="grid grid-cols-4 gap-x-2 gap-y-3">
              {grupo.itens.map((item) => {
                const atraso = { "--atraso": `${indice++ * 25}ms` } as CSSProperties;
                const Icon = item.icon;
                const azulejo = (
                  <>
                    <span className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-2xl border transition-[transform,background-color,color] duration-200 group-active:scale-90",
                      "border-primary/15 bg-gradient-to-b from-primary/[0.12] to-primary/[0.04] text-primary",
                      "group-aria-[current=page]:border-primary group-aria-[current=page]:from-primary group-aria-[current=page]:to-primary/85 group-aria-[current=page]:text-primary-foreground group-aria-[current=page]:shadow-brand-md",
                    )}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="line-clamp-2 text-[11px] font-medium leading-tight">{item.title}</span>
                  </>
                );
                const classe = "group flex w-full flex-col items-center gap-1.5 rounded-xl p-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
                return (
                  <li key={item.title} className={cn(aberto && "dock-item-entra")} style={atraso}>
                    {ehLink(item) ? (
                      <NavLink to={item.url} end tabIndex={aberto ? 0 : -1} className={classe}>{azulejo}</NavLink>
                    ) : (
                      <button type="button" tabIndex={aberto ? 0 : -1} className={classe} onClick={() => { fechar(); item.onClick(); }}>{azulejo}</button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <div className="mt-4 flex items-center gap-2">
          {rodape}
          <button
            type="button"
            onClick={onSair}
            tabIndex={aberto ? 0 : -1}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border/60 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sair
          </button>
        </div>
      </div>

      {/* Dock flutuante */}
      <nav
        aria-label={rotulo}
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex items-center gap-1 rounded-2xl border border-border/60 bg-card/90 p-1.5 shadow-brand-lg backdrop-blur-xl"
      >
        <PillDeslizante id={`${id}-dock`} seletor='[data-ativo="true"]' className="flex flex-1 items-center gap-1" pillClassName="rounded-xl">
          {principais.map(({ title, url, icon: Icon }) => {
            const ativo = !gradeAtiva && url === ativoPrincipal;
            return (
              <NavLink
                key={url}
                to={url}
                end
                aria-label={title}
                data-ativo={ativo}
                className={cn(
                  "flex h-11 flex-1 items-center justify-center rounded-xl transition-colors duration-500",
                  ativo ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </NavLink>
            );
          })}

          <span aria-hidden="true" className="mx-0.5 h-6 w-px shrink-0 bg-border" />

          <button
            type="button"
            onClick={() => { setAberto((v) => !v); campoBusca.current?.blur(); }}
            aria-expanded={aberto}
            aria-controls={`${id}-paginas`}
            aria-label={aberto ? "Fechar páginas" : "Todas as páginas"}
            data-ativo={gradeAtiva}
            className={cn(
              "flex h-11 flex-1 items-center justify-center rounded-xl transition-colors duration-500",
              gradeAtiva ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="relative h-5 w-5">
              <LayoutGrid className={cn("absolute inset-0 h-5 w-5 transition-all duration-300", aberto ? "rotate-90 scale-0 opacity-0" : "opacity-100")} aria-hidden="true" />
              <X className={cn("absolute inset-0 h-5 w-5 transition-all duration-300", aberto ? "opacity-100" : "-rotate-90 scale-0 opacity-0")} aria-hidden="true" />
            </span>
          </button>
        </PillDeslizante>

        {/* Assistente de IA no lugar do "+" */}
        <button
          type="button"
          onClick={() => { fechar(); onAssistente(); }}
          aria-label="Abrir assistente"
          className="ml-1 flex h-11 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary transition-transform active:scale-95"
        >
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </button>
      </nav>
    </div>
  );
}
