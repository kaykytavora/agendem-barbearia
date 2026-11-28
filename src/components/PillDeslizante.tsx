import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Posicao {
  top: number;
  bottom: number;
  left: number;
  right: number;
  /** Direção do último movimento: a borda que vai na frente anda mais rápido */
  descendo: boolean;
  /** Movimento horizontal (dock): a borda da frente é a da direita ou da esquerda */
  paraDireita: boolean;
  visivel: boolean;
  /** Conta os movimentos para reiniciar o brilho a cada troca */
  passo: number;
}

const OCULTA: Posicao = { top: 0, bottom: 0, left: 0, right: 0, descendo: true, paraDireita: true, visivel: false, passo: 0 };

/**
 * Última posição de cada menu. Cada página monta o layout de novo, então sem isso o
 * destaque nasceria do zero a cada navegação; com ela, ele parte de onde estava.
 */
const memoria = new Map<string, Posicao>();

/**
 * Envolve uma lista de links (NavLink) e desenha atrás do item ativo um destaque que
 * "escorre" até o próximo: a borda da frente chega primeiro e a de trás alcança depois,
 * como uma onda subindo ou descendo. Os itens ativos precisam ter aria-current="page"
 * (o NavLink já coloca) e não devem ter fundo próprio.
 */
export function PillDeslizante({ id, children, className, pillClassName, seletor = '[aria-current="page"]' }: {
  /** Como achar o item ativo (padrão: o link da página atual) */
  seletor?: string;
  /** Identifica o menu para lembrar a posição entre páginas */
  id: string;
  children: ReactNode;
  className?: string;
  pillClassName?: string;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Posicao>(() => memoria.get(id) ?? OCULTA);
  const atual = useRef(pos);
  atual.current = pos;

  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    let quadro = 0;

    const medir = () => {
      const ativo = el.querySelector<HTMLElement>(seletor);
      if (!ativo) {
        if (atual.current.visivel) setPos((p) => ({ ...p, visivel: false }));
        return;
      }
      const anterior = atual.current;
      // Medida pela tela: offsetTop seria relativo ao <li> (que tem position: relative) e daria 0
      const caixaRect = el.getBoundingClientRect();
      const itemRect = ativo.getBoundingClientRect();
      const top = Math.round(itemRect.top - caixaRect.top);
      const nova: Posicao = {
        top,
        bottom: Math.round(caixaRect.bottom - itemRect.bottom),
        left: Math.round(itemRect.left - caixaRect.left),
        right: Math.round(caixaRect.right - itemRect.right),
        descendo: anterior.visivel ? top >= anterior.top : true,
        paraDireita: anterior.visivel ? Math.round(itemRect.left - caixaRect.left) >= anterior.left : true,
        visivel: true,
        passo: anterior.passo + (anterior.visivel ? 1 : 0),
      };
      if (anterior.visivel && anterior.top === nova.top && anterior.bottom === nova.bottom
        && anterior.left === nova.left && anterior.right === nova.right) return;
      memoria.set(id, nova);
      setPos(nova);
    };

    // Espera dois quadros: o destaque é pintado primeiro na posição lembrada e só então
    // vai para a nova, para a transição acontecer de fato.
    const agendar = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => { quadro = requestAnimationFrame(medir); });
    };
    agendar();

    // Itens que aparecem depois (carregamento, troca de página) ou mudam de tamanho
    const mutacoes = new MutationObserver(agendar);
    mutacoes.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-current", "data-ativo"] });
    const tamanho = new ResizeObserver(agendar);
    tamanho.observe(el);
    return () => {
      cancelAnimationFrame(quadro);
      mutacoes.disconnect();
      tamanho.disconnect();
    };
  }, [id, seletor]);

  // Borda da frente: chega antes, passa um pouco e volta (quique); a de trás vem devagar
  const frente = "520ms cubic-bezier(0.34, 1.45, 0.64, 1)";
  const tras = "820ms cubic-bezier(0.65, 0, 0.25, 1)";

  return (
    <div ref={caixa} className={cn("relative isolate", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -z-10 rounded-xl bg-gradient-to-r from-primary to-primary/75 shadow-brand-md",
          "motion-reduce:!transition-none",
          !pos.visivel && "opacity-0",
          pillClassName,
        )}
        style={{
          top: pos.top,
          bottom: pos.bottom,
          left: pos.left,
          right: pos.right,
          transition: `top ${pos.descendo ? tras : frente}, bottom ${pos.descendo ? frente : tras}, left ${pos.paraDireita ? tras : frente}, right ${pos.paraDireita ? frente : tras}, opacity 250ms`,
        }}
      >
        {/* Faixa de luz que atravessa o destaque no sentido do movimento */}
        {pos.passo > 0 && (
          <span key={pos.passo} className="pill-brilho absolute inset-0 overflow-hidden rounded-[inherit]" data-sentido={pos.descendo ? "desce" : "sobe"} />
        )}
      </span>
      {children}
    </div>
  );
}
