import { Instagram, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LazyImage } from "@/components/LazyImage";
import type { FeedbackWithProfile } from "@/hooks/useBarbershopDetails";
import { horariosDaSemana, type HorarioDia } from "@/lib/horarios";

interface ShopInfoAsideProps {
  nome: string;
  descricao?: string | null;
  instagramHref?: string;
  facebookHref?: string | null;
  fotos: string[];
  horarios: HorarioDia[];
  feedbacks: FeedbackWithProfile[];
}

/** Coluna lateral da página da barbearia: sobre, horários, fotos e avaliações. */
export function ShopInfoAside({ nome, descricao, instagramHref, facebookHref, fotos, horarios, feedbacks }: ShopInfoAsideProps) {
  const semana = horariosDaSemana(horarios);
  return (
    <aside className="space-y-4">
      {(descricao || instagramHref || facebookHref) && (
        <div className="rounded-3xl border bg-card p-5">
          <h2 className="mb-2 text-lg font-bold">Sobre</h2>
          {descricao && <p className="text-sm leading-relaxed text-muted-foreground">{descricao}</p>}
          {(instagramHref || facebookHref) && (
            <div className="mt-3 flex gap-4">
              {instagramHref && (
                <a href={instagramHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                  <Instagram className="h-4 w-4" aria-hidden="true" />
                  Instagram
                </a>
              )}
              {facebookHref && (
                <a href={facebookHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                  Facebook
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {semana.some((d) => d.horario) && (
        <div className="rounded-3xl border bg-card p-5">
          <h2 className="mb-3 text-lg font-bold">Horários</h2>
          <dl className="space-y-1.5 text-sm">
            {semana.map((d) => {
              const hoje = d.dia === new Date().getDay();
              return (
                <div key={d.dia} className={`flex justify-between gap-4 ${hoje ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  <dt>{d.nome}{hoje && <span className="sr-only"> (hoje)</span>}</dt>
                  <dd>{d.horario ?? "Fechado"}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      )}

      {fotos.length > 0 && (
        <div className="rounded-3xl border bg-card p-5">
          <h2 className="mb-3 text-lg font-bold">Fotos</h2>
          <div className="grid grid-cols-2 gap-2">
            {fotos.slice(0, 4).map((url, index) => (
              <LazyImage key={url} src={url} alt={`Foto ${index + 1} da ${nome}`} className="aspect-square w-full rounded-2xl object-cover" />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-3xl border bg-card p-5">
        <h2 className="mb-3 text-lg font-bold">Avaliações</h2>
        {feedbacks.length > 0 ? (
          <ul className="space-y-3">
            {feedbacks.map((feedback) => (
              <li key={feedback.id} className="flex gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={feedback.profiles?.avatar_url || undefined} alt="" />
                  <AvatarFallback>{feedback.anonimo ? "A" : feedback.profiles?.name?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{feedback.anonimo ? "Anônimo" : feedback.profiles?.name || "Cliente"}</p>
                    <div className="flex" role="img" aria-label={`${feedback.rating || 0} de 5 estrelas`}>
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${i < (feedback.rating || 0) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
                          aria-hidden="true"
                        />
                      ))}
                    </div>
                  </div>
                  {feedback.comment && <p className="mt-1 text-sm text-muted-foreground">{feedback.comment}</p>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Ainda não há avaliações. Elas aparecem depois que o atendimento é finalizado.</p>
        )}
      </div>
    </aside>
  );
}
