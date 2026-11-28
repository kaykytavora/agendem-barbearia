import { Check, Clock } from "lucide-react";
import { cn, formatBRL } from "@/lib/utils";

export interface ServiceOption {
  id: string;
  nome: string;
  duracao_minutos: number;
  valor: number;
  descricao?: string | null;
}

interface ServiceListProps {
  services: ServiceOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ServiceList({ services, selectedId, onSelect }: ServiceListProps) {
  return (
    <div className="grid gap-2.5">
      {services.map((service) => {
        const selected = service.id === selectedId;
        return (
          <button
            key={service.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(service.id)}
            className={cn(
              "group flex w-full items-center gap-3.5 rounded-2xl border bg-card px-4 py-3.5 text-left",
              "shadow-brand-sm transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100",
              selected
                ? "border-primary/70 bg-primary/[0.06] shadow-brand-md"
                : "border-border/60 hover:-translate-y-0.5 hover:border-border hover:shadow-brand-md motion-reduce:hover:translate-y-0",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200",
                selected ? "border-primary bg-primary text-primary-foreground" : "border-input group-hover:border-primary/50",
              )}
            >
              <Check className={cn("h-3 w-3 transition-transform duration-200", selected ? "scale-100" : "scale-0")} strokeWidth={3} />
            </span>

            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="truncate font-semibold">{service.nome}</p>
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {service.duracao_minutos} min
              </p>
              {service.descricao && <p className="line-clamp-2 text-sm text-muted-foreground">{service.descricao}</p>}
            </div>

            <span className={cn("shrink-0 font-display text-base font-bold tabular-nums sm:text-lg", selected && "text-primary")}>
              {formatBRL(service.valor)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
