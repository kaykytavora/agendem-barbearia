import { cn } from '@/lib/utils';
import type { AgendaSlot as AgendaSlotType } from '@/hooks/useAgendaData';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Phone, Clock, User, Scissors } from 'lucide-react';

interface AgendaSlotProps {
  slot: AgendaSlotType;
  onClick?: (slot: AgendaSlotType) => void;
  expanded?: boolean;
}

const statusStyles = {
  disponivel: 'bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30 cursor-pointer',
  ocupado: 'bg-red-500/20 border-red-500/50 hover:bg-red-500/30 cursor-pointer',
  pausa: 'bg-amber-500/20 border-amber-500/50',
  fechado: 'bg-muted border-muted-foreground/20',
  ausente: 'bg-orange-500/20 border-orange-500/50',
};

const statusLabels = {
  disponivel: 'Disponível',
  ocupado: 'Ocupado',
  pausa: 'Pausa',
  fechado: 'Fechado',
  ausente: 'Ausente',
};

export function AgendaSlot({ slot, onClick, expanded = false }: AgendaSlotProps) {
  const handleClick = () => {
    if (onClick && (slot.status === 'disponivel' || slot.status === 'ocupado')) {
      onClick(slot);
    }
  };

  // Expanded mobile view
  if (expanded) {
    return (
      <div
        className={cn(
          'rounded-lg border p-2.5 transition-colors',
          statusStyles[slot.status]
        )}
        onClick={handleClick}
      >
        {slot.status === 'ocupado' && slot.agendamento ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm text-red-700 dark:text-red-300">
                {slot.agendamento.cliente_nome}
              </span>
              <span className="text-xs text-red-600/70 dark:text-red-400/70">
                {slot.agendamento.servico_duracao}min
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-red-600/80 dark:text-red-400/80">
              <span className="flex items-center gap-1">
                <Scissors className="w-3 h-3" />
                {slot.agendamento.servico_nome}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {slot.agendamento.cliente_telefone}
              </span>
            </div>
          </div>
        ) : slot.status === 'pausa' ? (
          <div className="flex items-center justify-between">
            <span className="text-amber-700 dark:text-amber-300 font-medium text-sm">
              Pausa
            </span>
            {slot.pausa?.motivo && (
              <span className="text-xs text-amber-600/70 dark:text-amber-400/70">
                {slot.pausa.motivo}
              </span>
            )}
          </div>
        ) : slot.status === 'ausente' ? (
          <span className="text-orange-700 dark:text-orange-300 font-medium text-sm">
            Ausente
          </span>
        ) : (
          <span className="text-emerald-700 dark:text-emerald-300 font-medium text-sm">
            {statusLabels[slot.status]}
          </span>
        )}
      </div>
    );
  }

  // Compact grid view (week mode)
  const content = (
    <div
      className={cn(
        'h-7 border rounded-sm transition-colors flex items-center justify-center text-[10px]',
        statusStyles[slot.status]
      )}
      onClick={handleClick}
    >
      {slot.status === 'ocupado' && slot.agendamento && (
        <span className="truncate px-0.5 font-medium text-red-700 dark:text-red-300">
          {slot.agendamento.cliente_nome.split(' ')[0]}
        </span>
      )}
      {slot.status === 'pausa' && (
        <span className="text-amber-700 dark:text-amber-300 font-medium">P</span>
      )}
      {slot.status === 'ausente' && (
        <span className="text-orange-700 dark:text-orange-300 font-medium">A</span>
      )}
    </div>
  );

  if (slot.status === 'ocupado' && slot.agendamento) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-2 p-1">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{slot.agendamento.cliente_nome}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{slot.agendamento.cliente_telefone}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">
                {slot.agendamento.servico_nome} ({slot.agendamento.servico_duracao}min)
              </span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (slot.status === 'pausa' && slot.pausa?.motivo) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>
          <p>{slot.pausa.motivo}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}