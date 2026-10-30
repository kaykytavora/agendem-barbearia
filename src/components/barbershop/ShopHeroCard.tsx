import { Clock, MessageCircle, Star } from "lucide-react";
import { LazyImage } from "@/components/LazyImage";
import type { BarbershopStats } from "@/hooks/useBarbershopDetails";

interface ShopHeroCardProps {
  nome: string;
  logoUrl?: string | null;
  endereco?: string;
  stats: BarbershopStats;
  whatsAppHref?: string;
}

/** Cartão do topo da página da barbearia, na cor dela. */
export function ShopHeroCard({ nome, logoUrl, endereco, stats, whatsAppHref }: ShopHeroCardProps) {
  return (
    <section className="rounded-3xl bg-primary p-5 text-primary-foreground sm:p-7">
      <div className="flex items-center gap-4">
        {logoUrl ? (
          <LazyImage
            src={logoUrl}
            alt={`Logo da ${nome}`}
            className="h-16 w-16 shrink-0 rounded-2xl bg-primary-foreground/15 object-cover sm:h-20 sm:w-20"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15 font-display text-2xl font-extrabold sm:h-20 sm:w-20">
            {nome?.charAt(0) || "B"}
          </div>
        )}
        <div className="min-w-0 space-y-1">
          <h1 className="font-display text-2xl font-extrabold leading-tight sm:text-4xl">{nome}</h1>
          {endereco && <p className="text-sm text-primary-foreground/85 sm:text-base">{endereco}</p>}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="inline-flex h-8 items-center gap-2 rounded-full bg-primary-foreground/15 px-3 text-sm font-semibold">
          <span className={`h-2 w-2 rounded-full ${stats.isOpen ? "bg-emerald-300" : "bg-primary-foreground/60"}`} aria-hidden="true" />
          {stats.isOpen ? "Aberto agora" : "Fechado agora"}
        </span>
        {stats.horarioFormatado && (
          <span className="inline-flex h-8 items-center gap-2 rounded-full bg-primary-foreground/15 px-3 text-sm font-semibold">
            <Clock className="h-4 w-4" aria-hidden="true" />
            {stats.diasFormatado} · {stats.horarioFormatado}
          </span>
        )}
        <span className="inline-flex h-8 items-center gap-2 rounded-full bg-primary-foreground/15 px-3 text-sm font-semibold">
          <Star className="h-4 w-4 fill-current" aria-hidden="true" />
          {stats.totalAvaliacoes > 0
            ? `${stats.mediaAvaliacoes.toFixed(1).replace(".", ",")} (${stats.totalAvaliacoes})`
            : "Sem avaliações"}
        </span>
        {whatsAppHref && (
          <a
            href={whatsAppHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-2 rounded-full bg-primary-foreground px-3 text-sm font-semibold text-foreground hover:bg-primary-foreground/90"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            WhatsApp
          </a>
        )}
      </div>
    </section>
  );
}
