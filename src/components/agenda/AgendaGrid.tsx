import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AgendaSlot } from './AgendaSlot';
import type { AgendaDay, AgendaSlot as AgendaSlotType } from '@/hooks/useAgendaData';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AgendaGridProps {
  days: AgendaDay[];
  viewMode: 'week' | 'day';
  selectedDayIndex: number;
  onSlotClick?: (slot: AgendaSlotType) => void;
}

export function AgendaGrid({ days, viewMode, selectedDayIndex, onSlotClick }: AgendaGridProps) {
  // Get all unique time slots from the first non-empty day
  const timeSlots = days.find(d => d.slots.length > 0)?.slots.map(s => s.hora) || [];
  const uniqueTimeSlots = [...new Set(timeSlots)];

  const displayDays = viewMode === 'day' ? [days[selectedDayIndex]] : days;
  const isSingleDay = viewMode === 'day';

  if (days.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        Carregando agenda...
      </div>
    );
  }

  if (isSingleDay) {
    // Mobile-optimized single day view
    const day = displayDays[0];
    
    return (
      <ScrollArea className="h-[calc(100vh-340px)] min-h-[250px]">
        <div className="space-y-1 px-2 pb-4">
          {day.fechado ? (
            <div className="flex items-center justify-center h-32 bg-muted/30 rounded-lg">
              <span className="text-muted-foreground text-sm">Fechado</span>
            </div>
          ) : (
            uniqueTimeSlots.map((time) => {
              const slot = day.slots.find(s => s.hora === time);
              if (!slot) return null;
              
              return (
                <div 
                  key={time}
                  className="flex items-center gap-2 py-1"
                >
                  <span className="text-xs font-medium text-muted-foreground w-12 text-right flex-shrink-0">
                    {time}
                  </span>
                  <div className="flex-1">
                    <AgendaSlot 
                      slot={slot} 
                      onClick={onSlotClick}
                      expanded
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    );
  }

  // Week view (desktop/tablet)
  return (
    <ScrollArea className="h-[calc(100vh-320px)] min-h-[400px]">
      <div className="overflow-x-auto">
        <div className="grid gap-0.5 min-w-0 grid-cols-[50px_repeat(7,1fr)]">
          {/* Header row */}
          <div className="sticky top-0 z-10 bg-background" />
          {displayDays.map((day) => (
            <div
              key={day.data.toISOString()}
              className={cn(
                'sticky top-0 z-10 bg-background p-2 text-center border-b',
                isToday(day.data) && 'bg-primary/10'
              )}
            >
              <div className={cn(
                'text-xs font-medium capitalize',
                isToday(day.data) && 'text-primary'
              )}>
                {format(day.data, 'EEE', { locale: ptBR })}
              </div>
              <div className={cn(
                'text-base font-bold',
                isToday(day.data) && 'text-primary'
              )}>
                {format(day.data, 'd')}
              </div>
              {day.fechado && (
                <span className="text-[10px] text-muted-foreground">Fechado</span>
              )}
            </div>
          ))}

          {/* Time slots */}
          {uniqueTimeSlots.map((time) => (
            <>
              <div
                key={`time-${time}`}
                className="text-[10px] text-muted-foreground text-right pr-2 pt-1 font-medium"
              >
                {time}
              </div>
              {displayDays.map((day) => {
                const slot = day.slots.find(s => s.hora === time);
                if (day.fechado) {
                  return (
                    <div
                      key={`${day.data.toISOString()}-${time}`}
                      className="h-7 bg-muted/30 rounded-sm border border-muted"
                    />
                  );
                }
                if (!slot) {
                  return (
                    <div
                      key={`${day.data.toISOString()}-${time}`}
                      className="h-7"
                    />
                  );
                }
                return (
                  <AgendaSlot
                    key={`${day.data.toISOString()}-${time}`}
                    slot={slot}
                    onClick={onSlotClick}
                  />
                );
              })}
            </>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}