import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Funcionario {
  id: string;
  nome: string;
  nivel: string;
  is_owner: boolean | null;
}

interface AgendaHeaderProps {
  weekStart: Date;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  funcionarios?: Funcionario[];
  selectedFuncionarioId: string | null;
  onFuncionarioChange: (id: string) => void;
  canSelectFuncionario: boolean;
  viewMode: 'week' | 'day';
  onViewModeChange: (mode: 'week' | 'day') => void;
  showViewToggle?: boolean;
}

export function AgendaHeader({
  weekStart,
  onPreviousWeek,
  onNextWeek,
  onToday,
  funcionarios,
  selectedFuncionarioId,
  onFuncionarioChange,
  canSelectFuncionario,
  viewMode,
  onViewModeChange,
  showViewToggle = true,
}: AgendaHeaderProps) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const formatWeekRange = () => {
    const startDay = format(weekStart, 'd');
    const endDay = format(weekEnd, 'd');
    const month = format(weekEnd, 'MMM', { locale: ptBR });
    return `${startDay} - ${endDay} ${month}`;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Navigation row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onPreviousWeek} 
            className="h-8 w-8"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onToday} 
            className="h-8 px-3 text-xs font-medium"
          >
            Hoje
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onNextWeek} 
            className="h-8 w-8"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Week range */}
        <span className="font-semibold text-sm capitalize flex-1 text-center">
          {formatWeekRange()}
        </span>

        {/* View Mode Toggle - Only show on desktop */}
        {showViewToggle && (
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <Button
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-3 text-xs rounded-md"
              onClick={() => onViewModeChange('week')}
            >
              Sem
            </Button>
            <Button
              variant={viewMode === 'day' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-3 text-xs rounded-md"
              onClick={() => onViewModeChange('day')}
            >
              Dia
            </Button>
          </div>
        )}
      </div>

      {/* Employee Selector */}
      {canSelectFuncionario && funcionarios && funcionarios.length > 0 && (
        <Select value={selectedFuncionarioId || ''} onValueChange={onFuncionarioChange}>
          <SelectTrigger className="w-full h-9 text-sm">
            <SelectValue placeholder="Selecionar funcionário" />
          </SelectTrigger>
          <SelectContent>
            {funcionarios.map((f) => (
              <SelectItem key={f.id} value={f.id} className="text-sm">
                {f.nome} {f.is_owner && '(Dono)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}