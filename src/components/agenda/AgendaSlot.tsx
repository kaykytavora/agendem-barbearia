import { cn } from '@/lib/utils';
import type { AgendaSlot as AgendaSlotType } from '@/hooks/useAgendaData';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, Coffee, Phone, Plus, Scissors, User, Plane } from 'lucide-react';

interface AgendaSlotProps {
  slot: AgendaSlotType;
  onClick?: (slot: AgendaSlotType) => void;
  expanded?: boolean;
}

/** Cor do horário ocupado conforme o status do agendamento */
const corOcupado: Record<string, string> = {
  pendente: 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25',
  confirmado: 'bg-primary border-primary text-primary-foreground hover:bg-primary/90',
  finalizado: 'bg-muted border-border text-muted-foreground hover:bg-muted/80',
};

const rotuloStatus: Record<string, string> = {
  pendente: 'Aguardando confirmação',
  confirmado: 'Confirmado',
  finalizado: 'Atendido',
};

function estilo(slot: AgendaSlotType) {
  switch (slot.status) {
    case 'ocupado':
      return cn('cursor-pointer border shadow-brand-sm', corOcupado[slot.agendamento?.status ?? 'confirmado'] ?? corOcupado.confirmado);
    case 'disponivel':
      return 'group cursor-pointer border border-dashed border-primary/40 bg-primary/[0.03] text-transparent hover:border-primary/70 hover:bg-primary/10 hover:text-primary dark:border-primary/50';
    case 'pausa':
      return 'border border-amber-500/30 bg-[repeating-linear-gradient(135deg,hsl(38_92%_50%/0.12)_0_6px,transparent_6px_12px)] text-amber-700 dark:text-amber-400';
    case 'ausente':
      return 'border border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400';
    default:
      return 'border border-transparent bg-muted/40';
  }
}

export function AgendaSlot({ slot, onClick, expanded = false }: AgendaSlotProps) {
  const clicavel = !!onClick && (slot.status === 'disponivel' || slot.status === 'ocupado');
  const agendamento = slot.agendamento;
  const rotulo = slot.status === 'ocupado' && agendamento
    ? `${slot.hora}: ${agendamento.cliente_nome}, ${agendamento.servico_nome}. Ver detalhes`
    : slot.status === 'disponivel' ? `${slot.hora}: livre. Criar agendamento` : undefined;

  const props = clicavel
    ? { role: 'button' as const, tabIndex: 0, 'aria-label': rotulo, onClick: () => onClick!(slot),
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick!(slot); } } }
    : {};
  const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

  // Visão de um dia (celular): linhas maiores com detalhes
  if (expanded) {
    return (
      <div {...props} className={cn('rounded-xl px-3 py-2.5 transition-colors', estilo(slot), foco)}>
        {slot.status === 'ocupado' && agendamento && slot.posicao && slot.posicao !== 'unico' && slot.posicao !== 'inicio' ? (
          <span className="text-xs opacity-80">↳ {agendamento.cliente_nome} · até {agendamento.horario.split(' – ')[1]}</span>
        ) : slot.status === 'ocupado' && agendamento ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold">{agendamento.cliente_nome}</span>
              <span className="shrink-0 text-xs opacity-80">{agendamento.horario}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs opacity-80">
              <span className="flex items-center gap-1"><Scissors className="h-3 w-3" aria-hidden="true" />{agendamento.servico_nome}</span>
              <span>{rotuloStatus[agendamento.status] ?? agendamento.status}</span>
            </div>
          </div>
        ) : slot.status === 'pausa' ? (
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Coffee className="h-3.5 w-3.5" aria-hidden="true" /> Pausa{slot.pausa?.motivo ? ` · ${slot.pausa.motivo}` : ''}
          </span>
        ) : slot.status === 'ausente' ? (
          <span className="flex items-center gap-1.5 text-sm font-medium"><Plane className="h-3.5 w-3.5" aria-hidden="true" /> Ausente</span>
        ) : slot.status === 'disponivel' ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground group-hover:text-primary">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Livre
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Fechado</span>
        )}
      </div>
    );
  }

  // Grade da semana: célula compacta
  // Meias horas do mesmo atendimento se juntam: cobrem o espaço entre as linhas e perdem as bordas internas
  const bloco = {
    unico: '',
    inicio: 'relative z-[1] -mb-1 h-9 rounded-b-none border-b-0',
    meio: 'relative z-[1] -mb-1 h-9 rounded-none border-y-0',
    fim: 'rounded-t-none border-t-0',
  }[slot.posicao ?? 'unico'];
  const primeiro = !slot.posicao || slot.posicao === 'unico' || slot.posicao === 'inicio';
  const conteudo = (
    <div {...props} className={cn('flex h-8 items-center justify-center rounded-lg px-1 text-[11px] transition-colors', estilo(slot), bloco, foco)}>
      {slot.status === 'ocupado' && agendamento && primeiro && (
        <span className="truncate font-semibold">{agendamento.cliente_nome.split(' ')[0]}</span>
      )}
      {slot.status === 'ocupado' && agendamento && slot.posicao && slot.posicao !== 'unico' && slot.posicao !== 'inicio' && (
        <span className="sr-only">continuação de {agendamento.cliente_nome}</span>
      )}
      {slot.status === 'disponivel' && <Plus className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />}
      {slot.status === 'pausa' && <Coffee className="h-3.5 w-3.5" aria-label="Pausa" />}
      {slot.status === 'ausente' && <Plane className="h-3.5 w-3.5" aria-label="Ausente" />}
    </div>
  );

  if (slot.status === 'ocupado' && agendamento) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{conteudo}</TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <div className="space-y-1.5 p-1 text-sm">
            <p className="flex items-center gap-2 font-semibold"><User className="h-4 w-4 text-muted-foreground" />{agendamento.cliente_nome}</p>
            <p className="flex items-center gap-2"><Scissors className="h-4 w-4 text-muted-foreground" />{agendamento.servico_nome}</p>
            <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" />{agendamento.horario} · {agendamento.servico_duracao} min</p>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{agendamento.cliente_telefone}</p>
            <p className="pt-1 text-xs text-muted-foreground">{rotuloStatus[agendamento.status] ?? agendamento.status} · clique para ver detalhes</p>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (slot.status === 'pausa' && slot.pausa?.motivo) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{conteudo}</TooltipTrigger>
        <TooltipContent><p>{slot.pausa.motivo}</p></TooltipContent>
      </Tooltip>
    );
  }

  return conteudo;
}
