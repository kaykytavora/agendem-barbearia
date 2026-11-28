import { Coffee, Plane, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const itens = [
  { rotulo: 'Livre', classe: 'border border-dashed border-primary/40 bg-primary/[0.03] dark:border-primary/50', icone: <Plus className="h-3 w-3 text-primary" /> },
  { rotulo: 'Confirmado', classe: 'border border-primary bg-primary' },
  { rotulo: 'Aguardando', classe: 'border border-amber-500/40 bg-amber-500/15' },
  { rotulo: 'Atendido', classe: 'border border-border bg-muted' },
  { rotulo: 'Pausa', classe: 'border border-amber-500/30 bg-amber-500/10', icone: <Coffee className="h-3 w-3 text-amber-700 dark:text-amber-400" /> },
  { rotulo: 'Ausente', classe: 'border border-orange-500/30 bg-orange-500/10', icone: <Plane className="h-3 w-3 text-orange-700 dark:text-orange-400" /> },
];

export function AgendaLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 py-2">
      {itens.map((item) => (
        <span key={item.rotulo} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden="true" className={cn('flex h-4 w-6 items-center justify-center rounded-md', item.classe)}>{item.icone}</span>
          {item.rotulo}
        </span>
      ))}
    </div>
  );
}
