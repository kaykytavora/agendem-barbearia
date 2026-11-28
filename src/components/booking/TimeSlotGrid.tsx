import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
    <div className="space-y-4 rounded-2xl border border-border/80 bg-gradient-to-br from-card/85 via-card/60 to-accent/50 p-3 shadow-sm backdrop-blur-md sm:p-4">
      {grupos.map((grupo) => (
        <div key={grupo.label} className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{grupo.label}</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-2">
            {grupo.itens.map(({ time, isAvailable }) => {
              const isSelected = isAvailable && selected === time;
              return (
                <Button
                  key={time}
                  type="button"
                  variant={isSelected ? "default" : isAvailable ? "glass" : "outline"}
                  disabled={!isAvailable}
                  aria-pressed={isSelected}
                  aria-label={isAvailable ? time : `${time}, ocupado`}
                  onClick={() => onSelect(time)}
                  className={cn(
                    "h-11 w-full rounded-xl border px-1 text-sm font-medium tabular-nums",
                    isSelected && "border-primary font-bold shadow-sm",
                    !isSelected && isAvailable && "border-border bg-card/70 shadow-sm hover:border-primary/40",
                    !isAvailable && "border-dashed border-input bg-transparent text-muted-foreground line-through disabled:opacity-75",
                  )}
                >
                  {time}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
