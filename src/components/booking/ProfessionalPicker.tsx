import { Button } from "@/components/ui/button";

interface ProfessionalPickerProps {
  professionals: { id: string; nome: string }[];
  selectedId: string | null | undefined;
  onSelect: (id: string | null) => void;
}

export function ProfessionalPicker({ professionals, selectedId, onSelect }: ProfessionalPickerProps) {
  const options = [{ id: null as string | null, nome: "Qualquer profissional" }, ...professionals];

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Profissional">
      {options.map((option) => {
        const selected = option.id === selectedId;
        return (
          <Button
            key={option.id ?? "qualquer"}
            type="button"
            variant={selected ? "default" : "glass"}
            aria-pressed={selected}
            onClick={() => onSelect(option.id)}
            className="h-auto min-h-11 max-w-full whitespace-normal rounded-full px-4 py-2 text-center [overflow-wrap:anywhere]"
          >
            {option.nome}
          </Button>
        );
      })}
    </div>
  );
}
