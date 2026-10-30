import { CheckCircle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BookingConfirmationCardProps {
  shopName: string;
  detalhes: { rotulo: string; valor?: string | null }[];
  canDownload: boolean;
  onDownload: () => void;
  /** Botão para o painel/agendamentos (só para quem está logado ou criou conta) */
  panelAction?: { label: string; onClick: () => void };
  onReset: () => void;
}

export function BookingConfirmationCard({ shopName, detalhes, canDownload, onDownload, panelAction, onReset }: BookingConfirmationCardProps) {
  return (
    <div className="rounded-3xl border bg-card p-6 text-center sm:p-8">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
        <CheckCircle className="h-9 w-9 text-primary" aria-hidden="true" />
      </div>
      <h2 className="text-2xl font-bold">Horário reservado!</h2>
      <p className="mt-1 text-muted-foreground">Te esperamos na {shopName}.</p>

      <dl className="mx-auto mt-6 max-w-sm space-y-2 rounded-2xl bg-secondary p-4 text-left text-sm">
        {detalhes
          .filter((d) => d.valor)
          .map((d) => (
            <div key={d.rotulo} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{d.rotulo}</dt>
              <dd className="text-right font-semibold first-letter:uppercase">{d.valor}</dd>
            </div>
          ))}
      </dl>

      <div className="mx-auto mt-6 grid max-w-sm gap-2">
        <Button size="lg" onClick={onDownload} disabled={!canDownload}>
          <Download />
          Baixar comprovante
        </Button>
        {panelAction && (
          <Button size="lg" variant="outline" onClick={panelAction.onClick}>
            {panelAction.label}
          </Button>
        )}
        <Button size="lg" variant="ghost" onClick={onReset}>
          Fazer outro agendamento
        </Button>
      </div>
    </div>
  );
}
