import { cn } from "@/lib/utils";

interface ProfessionalPickerProps {
  professionals: { id: string; nome: string }[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function ProfessionalPicker({ professionals, selectedId, onSelect }: ProfessionalPickerProps) {
  const options = [{ id: null as string | null, nome: "Qualquer profissional" }, ...professionals];

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Profissional">
      {options.map((option) => {
        const selected = option.id === selectedId;
        return (
          <button
            key={option.id ?? "qualquer"}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(option.id)}
            className={cn(
              "h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-input",
            )}
          >
            {option.nome}
          </button>
        );
      })}
    </div>
  );
}
