import { Check, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ProfessionalPickerProps {
  professionals: { id: string; nome: string; foto_url?: string | null }[];
  selectedId: string | null | undefined;
  onSelect: (id: string | null) => void;
}

const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

/** Escolha do profissional em cartões com foto (ou iniciais). */
export function ProfessionalPicker({ professionals, selectedId, onSelect }: ProfessionalPickerProps) {
  const options = [{ id: null as string | null, nome: "Qualquer profissional", foto_url: null }, ...professionals];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="group" aria-label="Profissional">
      {options.map((option) => {
        const selected = option.id === selectedId;
        return (
          <button
            key={option.id ?? "qualquer"}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(option.id)}
            className={cn(
              "relative flex flex-col items-center gap-2.5 rounded-2xl border bg-card px-3 py-4 text-center shadow-brand-sm",
              "transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "active:scale-[0.98] motion-reduce:transition-none",
              selected
                ? "border-primary/70 bg-primary/[0.06] shadow-brand-md"
                : "border-border/60 hover:-translate-y-0.5 hover:border-border hover:shadow-brand-md motion-reduce:hover:translate-y-0",
            )}
          >
            {selected && (
              <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
              </span>
            )}
            <Avatar className={cn("h-16 w-16 border-2 transition-colors", selected ? "border-primary" : "border-background")}>
              {option.foto_url && <AvatarImage src={option.foto_url} alt="" className="object-cover" />}
              <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
                {option.id === null ? <Users className="h-6 w-6" aria-hidden="true" /> : iniciais(option.nome)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium leading-tight [overflow-wrap:anywhere]">{option.nome}</span>
            {option.id === null && <span className="-mt-1.5 text-xs text-muted-foreground">quem estiver livre</span>}
          </button>
        );
      })}
    </div>
  );
}
