import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepperStep = "service" | "datetime" | "client";

const STEPS: { id: StepperStep; label: string }[] = [
  { id: "service", label: "Serviço" },
  { id: "datetime", label: "Horário" },
  { id: "client", label: "Seus dados" },
];

interface BookingStepperProps {
  current: StepperStep;
  /** Permite voltar para uma etapa já concluída */
  onStepClick?: (step: StepperStep) => void;
}

export function BookingStepper({ current, onStepClick }: BookingStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);

  return (
    <ol className="flex items-center gap-2" aria-label="Etapas do agendamento">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        const content = (
          <>
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                done && "bg-foreground text-background",
                active && "bg-primary text-primary-foreground",
                !done && !active && "bg-secondary text-muted-foreground",
              )}
            >
              {done ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
            </span>
            <span className={cn("text-sm font-semibold", !active && "text-muted-foreground")}>{step.label}</span>
          </>
        );

        return (
          <li key={step.id} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={active ? "step" : undefined}>
            {done && onStepClick ? (
              <button
                type="button"
                onClick={() => onStepClick(step.id)}
                className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Voltar para ${step.label}`}
              >
                {content}
              </button>
            ) : (
              <span className="flex items-center gap-2">{content}</span>
            )}
            {index < STEPS.length - 1 && (
              <span aria-hidden="true" className={cn("h-0.5 flex-1 rounded-full", done ? "bg-primary" : "bg-border")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
