import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface FotoLightboxProps {
  fotos: string[];
  nome: string;
  /** Índice aberto; null fecha o visualizador */
  index: number | null;
  onIndexChange: (index: number | null) => void;
}

const botaoNav =
  "absolute flex h-10 w-10 items-center justify-center rounded-full bg-white/15 backdrop-blur transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

/** Visualizador ampliado com navegação por botões, setas do teclado e deslize. */
export function FotoLightbox({ fotos, nome, index, onIndexChange }: FotoLightboxProps) {
  const toque = useRef<number | null>(null);
  const aberto = index !== null && fotos.length > 0;
  const atual = index ?? 0;
  const ir = (passo: number) => onIndexChange((atual + passo + fotos.length) % fotos.length);

  useEffect(() => {
    if (!aberto || fotos.length < 2) return;
    const teclado = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onIndexChange((atual + 1) % fotos.length);
      if (e.key === "ArrowLeft") onIndexChange((atual - 1 + fotos.length) % fotos.length);
    };
    window.addEventListener("keydown", teclado);
    return () => window.removeEventListener("keydown", teclado);
  }, [aberto, atual, fotos.length, onIndexChange]);

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogContent className="max-w-4xl gap-3 border-none bg-black/95 p-3 text-white sm:p-4 [&>button]:text-white">
        <DialogTitle className="sr-only">Fotos da {nome}</DialogTitle>
        <DialogDescription className="sr-only">Foto {atual + 1} de {fotos.length}</DialogDescription>
        <div
          className="relative flex items-center justify-center"
          onTouchStart={(e) => { toque.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (toque.current === null || fotos.length < 2) return;
            const delta = e.changedTouches[0].clientX - toque.current;
            if (Math.abs(delta) > 40) ir(delta < 0 ? 1 : -1);
            toque.current = null;
          }}
        >
          {aberto && (
            <img
              key={fotos[atual]}
              src={fotos[atual]}
              alt={`Foto ${atual + 1} da ${nome}`}
              className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain animate-in fade-in-0 zoom-in-95 duration-200"
            />
          )}
          {fotos.length > 1 && (
            <>
              <button type="button" onClick={() => ir(-1)} aria-label="Foto anterior" className={cn(botaoNav, "left-1")}>
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => ir(1)} aria-label="Próxima foto" className={cn(botaoNav, "right-1")}>
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>
        {fotos.length > 1 && (
          <div className="flex justify-center gap-2 overflow-x-auto pb-1">
            {fotos.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => onIndexChange(i)}
                aria-label={`Ver foto ${i + 1}`}
                aria-current={i === atual}
                className={cn(
                  "h-12 w-12 shrink-0 overflow-hidden rounded-lg transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                  i === atual ? "opacity-100 ring-2 ring-white" : "opacity-50 hover:opacity-80",
                )}
              >
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
