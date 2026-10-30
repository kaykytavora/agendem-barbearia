import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BookingSummaryBarProps {
  title: string;
  subtitle?: string;
  actionLabel: string;
  actionDisabled?: boolean;
  loading?: boolean;
  onAction: () => void;
  onBack?: () => void;
}

/** Resumo do agendamento que acompanha a rolagem, com o botão para avançar. */
export function BookingSummaryBar({ title, subtitle, actionLabel, actionDisabled, loading, onAction, onBack }: BookingSummaryBarProps) {
  return (
    <div className="sticky bottom-3 z-30 mt-4 flex items-center gap-3 rounded-3xl bg-foreground p-3 pl-4 text-background shadow-brand-lg sm:pl-5">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar uma etapa"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background/10 hover:bg-background/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="truncate text-[15px] font-semibold">{title}</p>
        {subtitle && <p className="line-clamp-2 text-sm text-background/75">{subtitle}</p>}
      </div>
      <Button size="lg" onClick={onAction} disabled={actionDisabled || loading} className="shrink-0 px-6">
        {loading && <Loader2 className="animate-spin" />}
        {actionLabel}
      </Button>
    </div>
  );
}
