import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dataLocalISO } from "@/lib/agenda";

interface DayPickerProps {
  /** Dias em que dá para agendar (abertos e sem ausência do profissional), em ordem. */
  dates: Date[];
  selected: Date | null;
  onSelect: (date: Date) => void;
}

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const nomeMes = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long" });

const inicioDaSemana = (d: Date) => {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay());
  return r;
};

const somarDias = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};

/**
 * Uma semana por vez (domingo a sábado), sem rolagem lateral: as 7 colunas cabem até no celular.
 * Dias fechados ou fora da janela de agendamento aparecem apagados, para o cliente entender o calendário.
 */
export function DayPicker({ dates, selected, onSelect }: DayPickerProps) {
  const disponiveis = useMemo(() => new Set(dates.map(dataLocalISO)), [dates]);

  const semanas = useMemo(() => {
    if (dates.length === 0) return [];
    const primeira = inicioDaSemana(dates[0]);
    const ultima = inicioDaSemana(dates[dates.length - 1]);
    const lista: Date[] = [];
    for (let s = primeira; s <= ultima; s = somarDias(s, 7)) lista.push(s);
    return lista;
  }, [dates]);

  const semanaDe = (d: Date | null) => {
    if (!d) return 0;
    const alvo = inicioDaSemana(d).getTime();
    return Math.max(0, semanas.findIndex((s) => s.getTime() === alvo));
  };

  const [pagina, setPagina] = useState(() => semanaDe(selected));

  // Ao trocar de profissional a lista de dias muda; volta para a semana do dia escolhido (ou a primeira)
  useEffect(() => {
    setPagina(semanaDe(selected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanas]);

  if (dates.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum dia disponível nos próximos 30 dias.</p>;
  }

  const inicio = semanas[Math.min(pagina, semanas.length - 1)];
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
  const fim = dias[6];
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const titulo =
    inicio.getMonth() === fim.getMonth()
      ? nomeMes(inicio)
      : `${nomeMes(inicio)} – ${nomeMes(fim)}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold capitalize" aria-live="polite">{titulo}</p>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPagina((p) => p - 1)}
            disabled={pagina === 0}
            aria-label="Semana anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPagina((p) => p + 1)}
            disabled={pagina >= semanas.length - 1}
            aria-label="Próxima semana"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 sm:gap-2" role="group" aria-label="Dias disponíveis">
        {dias.map((date) => {
          const livre = disponiveis.has(dataLocalISO(date));
          const isSelected = livre && selected?.toDateString() === date.toDateString();
          return (
            <button
              key={dataLocalISO(date)}
              type="button"
              disabled={!livre}
              aria-pressed={isSelected}
              aria-label={date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }) + (livre ? "" : ", indisponível")}
              onClick={() => onSelect(date)}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected && "border-primary bg-primary text-primary-foreground",
                !isSelected && livre && "bg-card hover:border-primary/60",
                !livre && "cursor-not-allowed border-transparent bg-muted/40 text-muted-foreground/50",
              )}
            >
              <span className={cn("text-[11px] sm:text-xs", !isSelected && "text-muted-foreground", !livre && "text-muted-foreground/50")}>
                {DIAS[date.getDay()]}
              </span>
              {/* Riscado só nos dias futuros sem atendimento; dias que já passaram ficam só apagados */}
              <span className={cn("text-base font-bold sm:text-lg", !livre && date >= hoje && "line-through decoration-1")}>{date.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
