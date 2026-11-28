import { useRef, useState } from "react";
import { Calendar, Clock, Heart, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resumirHorarios } from "@/lib/horarios";
import { rotuloLocal } from "@/lib/localizacao-barbearias";
import type { BarbershopListItem } from "@/hooks/useBarbershopsList";

const formatarPreco = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  shop: BarbershopListItem;
  favorita: boolean;
  onFavoritar: () => void;
  onAbrir: () => void;
}

/** Fotos da barbearia que dá para passar com o dedo (ou setas no desktop) sem abrir a página. */
function FotosCarrossel({ fotos, nome }: { fotos: string[]; nome: string }) {
  const trilho = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState(0);

  const irPara = (indice: number) => {
    const el = trilho.current;
    if (el) el.scrollTo({ left: indice * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="group/fotos relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-muted/50 sm:h-32 sm:w-32">
      <div
        ref={trilho}
        className="flex h-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={(e) => setAtual(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        onClick={(e) => e.stopPropagation()}
      >
        {fotos.map((foto, i) => (
          <img
            key={foto}
            src={foto}
            alt={i === 0 ? nome : `${nome} — foto ${i + 1}`}
            loading="lazy"
            draggable={false}
            className="h-full w-full shrink-0 snap-center object-cover"
          />
        ))}
      </div>
      {fotos.length > 1 && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-1.5 flex justify-center gap-1">
            {fotos.map((foto, i) => (
              <span key={foto} className={cn("h-1.5 rounded-full bg-white/70 shadow transition-all", i === atual ? "w-3 bg-white" : "w-1.5")} />
            ))}
          </div>
          {atual > 0 && (
            <button
              type="button"
              aria-label="Foto anterior"
              onClick={(e) => { e.stopPropagation(); irPara(atual - 1); }}
              className="absolute left-1 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-xs opacity-0 shadow transition group-hover/fotos:opacity-100 md:flex"
            >‹</button>
          )}
          {atual < fotos.length - 1 && (
            <button
              type="button"
              aria-label="Próxima foto"
              onClick={(e) => { e.stopPropagation(); irPara(atual + 1); }}
              className="absolute right-1 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-xs opacity-0 shadow transition group-hover/fotos:opacity-100 md:flex"
            >›</button>
          )}
        </>
      )}
    </div>
  );
}

export function BarbeariaCard({ shop, favorita, onFavoritar, onAbrir }: Props) {
  const fotos = [shop.logo_url, ...(shop.gallery_urls ?? [])].filter((f): f is string => !!f);
  const precos = shop.servicos.map((s) => Number(s.valor)).filter((v) => v > 0);
  const precoMinimo = precos.length ? Math.min(...precos) : null;
  const horario = resumirHorarios(shop.horarios_funcionamento)?.horas;

  return (
    <article
      onClick={onAbrir}
      className="depth-hover flex cursor-pointer flex-col gap-4 rounded-3xl border border-border/70 bg-card p-4 shadow-sm"
    >
      <div className="flex gap-4">
        <FotosCarrossel fotos={fotos.length ? fotos : ["/placeholder.svg"]} nome={shop.nome} />

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-base font-bold leading-tight sm:text-lg">{shop.nome}</h3>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
              {shop.rating > 0 ? shop.rating.toFixed(1) : "Novo"}
            </span>
          </div>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{rotuloLocal(shop.bairro, shop.cidade) || "Cidade não informada"}</span>
          </p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            <span className="truncate">{horario ?? "Horário não informado"}</span>
          </p>
          {precoMinimo !== null && (
            <p className="pt-1 text-sm text-muted-foreground">
              A partir de <strong className="text-lg font-bold text-primary">{formatarPreco(precoMinimo)}</strong>
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          variant="premium"
          className="h-11 flex-1"
          onClick={(e) => { e.stopPropagation(); onAbrir(); }}
        >
          <Calendar className="mr-2 h-4 w-4" />
          Ver barbearia
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label={favorita ? "Remover das favoritas" : "Salvar como favorita"}
          aria-pressed={favorita}
          className="h-11 w-11 shrink-0"
          onClick={(e) => { e.stopPropagation(); onFavoritar(); }}
        >
          <Heart className={cn("h-5 w-5 transition", favorita && "fill-red-500 text-red-500")} />
        </Button>
      </div>
    </article>
  );
}
