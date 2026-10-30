import { CheckCircle2 } from "lucide-react";
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
    <div className="grid gap-3">
      {services.map((service) => {
        const selected = service.id === selectedId;
        return (
          <button
            key={service.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(service.id)}
            className={cn(
              "flex w-full items-start justify-between gap-4 rounded-2xl border bg-card p-4 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected ? "border-primary bg-accent ring-1 ring-primary" : "hover:border-input",
            )}
          >
            <div className="min-w-0 space-y-1">
              <p className="font-semibold">{service.nome}</p>
              <p className="text-sm text-muted-foreground">{service.duracao_minutos} min</p>
              {service.descricao && <p className="line-clamp-2 text-sm text-muted-foreground">{service.descricao}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="font-display text-lg font-bold">{formatBRL(service.valor)}</span>
              {selected && <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />}
            </div>
          </button>
        );
      })}
    </div>
  );
}
