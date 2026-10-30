import { cn } from "@/lib/utils";
import type { Horario } from "@/lib/agenda";

interface TimeSlotGridProps {
  slots: Horario[];
  selected: string | null;
  onSelect: (time: string) => void;
}

const PERIODOS = [
  { label: "Manhã", ate: 12 },
  { label: "Tarde", ate: 18 },
  { label: "Noite", ate: 24 },
];

export function TimeSlotGrid({ slots, selected, onSelect }: TimeSlotGridProps) {
  if (!slots.some((s) => s.isAvailable)) {
    return (
      <p className="rounded-2xl border border-dashed border-input p-4 text-center text-sm text-muted-foreground">
        Nenhum horário livre neste dia. Escolha outro dia ou outro profissional.
      </p>
    );
  }

  let desde = 0;
  const grupos = PERIODOS.map(({ label, ate }) => {
    const itens = slots.filter((s) => {
      const hora = Number(s.time.slice(0, 2));
      return hora >= desde && hora < ate;
    });
    desde = ate;
    return { label, itens };
  }).filter((g) => g.itens.length > 0);

  return (
    <div className="space-y-4">
      {grupos.map((grupo) => (
        <div key={grupo.label} className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{grupo.label}</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {grupo.itens.map(({ time, isAvailable }) => {
              const isSelected = selected === time;
              return (
                <button
                  key={time}
                  type="button"
                  disabled={!isAvailable}
                  aria-pressed={isSelected}
                  aria-label={isAvailable ? time : `${time}, ocupado`}
                  onClick={() => onSelect(time)}
                  className={cn(
                    "h-12 rounded-2xl border text-[15px] font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected && "border-primary bg-primary font-bold text-primary-foreground",
                    !isSelected && isAvailable && "bg-card hover:border-input",
                    !isAvailable && "border-dashed border-input bg-transparent text-muted-foreground/70 line-through",
                  )}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
