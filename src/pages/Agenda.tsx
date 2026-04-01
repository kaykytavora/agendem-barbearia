import { useState, useEffect } from 'react';
import { startOfWeek, addWeeks, subWeeks, format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock } from 'lucide-react';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { AgendaHeader } from '@/components/agenda/AgendaHeader';
import { AgendaGrid } from '@/components/agenda/AgendaGrid';
import { AgendaLegend } from '@/components/agenda/AgendaLegend';
import { useAgendaData, useFuncionarios } from '@/hooks/useAgendaData';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export default function Agenda() {
  const { user } = useAuth();
  const { role, barbeariaId } = useUserRole();
  const isMobile = useIsMobile();
  
  const [weekStart, setWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => {
    // Start on current day of the week
    const today = new Date();
    const dayOfWeek = today.getDay();
    // Convert to Monday-based index (0 = Monday, 6 = Sunday)
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  });
  
  // Force day view on mobile, allow toggle on desktop
  const [desktopViewMode, setDesktopViewMode] = useState<'week' | 'day'>('week');
  const effectiveViewMode = isMobile ? 'day' : desktopViewMode;

  // No need for useEffect since we derive viewMode from isMobile
  useEffect(() => {
    // Reset to week on desktop
  }, []);

  // Check if user can select other employees (admin or gerente)
  const canSelectFuncionario = role === 'admin';

  // Fetch current user's funcionario record
  const { data: currentFuncionario } = useQuery({
    queryKey: ['current-funcionario', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('funcionarios')
        .select('id, nome, nivel, is_owner')
        .eq('user_id', user.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch all employees if user can select
  const { data: funcionarios, isLoading: loadingFuncionarios } = useFuncionarios(
    canSelectFuncionario ? barbeariaId : null
  );

  // Set initial funcionario
  useEffect(() => {
    if (currentFuncionario && !selectedFuncionarioId) {
      setSelectedFuncionarioId(currentFuncionario.id);
    }
  }, [currentFuncionario, selectedFuncionarioId]);

  // Fetch agenda data
  const { agenda, isLoading } = useAgendaData({
    funcionarioId: selectedFuncionarioId,
    barbeariaId,
    weekStart,
  });

  const handlePreviousWeek = () => setWeekStart(prev => subWeeks(prev, 1));
  const handleNextWeek = () => setWeekStart(prev => addWeeks(prev, 1));
  const handleToday = () => {
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const today = new Date();
    const dayOfWeek = today.getDay();
    setSelectedDayIndex(dayOfWeek === 0 ? 6 : dayOfWeek - 1);
  };

  const handleFuncionarioChange = (id: string) => {
    setSelectedFuncionarioId(id);
  };

  const selectedFuncionarioName = funcionarios?.find(f => f.id === selectedFuncionarioId)?.nome 
    || currentFuncionario?.nome 
    || 'Funcionário';

  return (
    <DashboardLayout>
      <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 pb-24 md:pb-6">
        {/* Compact Mobile Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg">
              <CalendarClock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-bold">Minha Agenda</h1>
              {!isMobile && (
                <p className="text-muted-foreground text-xs sm:text-sm">
                  {canSelectFuncionario 
                    ? 'Visualize a agenda de todos os funcionários'
                    : 'Visualize seus horários e agendamentos'}
                </p>
              )}
            </div>
          </div>
          {isMobile && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
              {selectedFuncionarioName.split(' ')[0]}
            </span>
          )}
        </div>

        {/* Main Card - Optimized for mobile */}
        <Card className="overflow-hidden border-0 sm:border shadow-sm">
          <CardContent className="p-0 sm:p-4">
            {/* Header with navigation */}
            <div className="p-3 sm:p-0 sm:mb-4 border-b sm:border-0">
              <AgendaHeader
                weekStart={weekStart}
                onPreviousWeek={handlePreviousWeek}
                onNextWeek={handleNextWeek}
                onToday={handleToday}
              funcionarios={funcionarios}
              selectedFuncionarioId={selectedFuncionarioId}
              onFuncionarioChange={handleFuncionarioChange}
              canSelectFuncionario={canSelectFuncionario}
              viewMode={effectiveViewMode}
              onViewModeChange={setDesktopViewMode}
              showViewToggle={!isMobile}
            />
            </div>

            {/* Mobile Day Selector - Pill style */}
            {effectiveViewMode === 'day' && (
              <div className="px-3 sm:px-0 pb-3">
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                  {agenda.map((day, index) => {
                    const isSelected = selectedDayIndex === index;
                    const isTodayDate = isToday(day.data);
                    return (
                      <button
                        key={day.data.toISOString()}
                        onClick={() => setSelectedDayIndex(index)}
                        className={cn(
                          'flex flex-col items-center min-w-[48px] py-2 px-3 rounded-xl transition-all',
                          isSelected
                            ? 'bg-primary text-primary-foreground shadow-md scale-105'
                            : isTodayDate
                            ? 'bg-primary/20 text-primary'
                            : 'bg-muted/50 hover:bg-muted'
                        )}
                      >
                        <span className={cn(
                          'text-[10px] uppercase font-medium',
                          isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                        )}>
                          {format(day.data, 'EEE', { locale: ptBR }).slice(0, 3)}
                        </span>
                        <span className={cn(
                          'text-lg font-bold leading-tight',
                          isSelected ? 'text-primary-foreground' : ''
                        )}>
                          {format(day.data, 'd')}
                        </span>
                        {day.fechado && (
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Legend - Compact on mobile */}
            <div className="px-3 sm:px-0 pb-2">
              <AgendaLegend />
            </div>

            {/* Grid */}
            <div className="px-1 sm:px-0">
              {isLoading || loadingFuncionarios || !selectedFuncionarioId ? (
                <div className="space-y-2 p-3">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : (
                <AgendaGrid
                  days={agenda}
                  viewMode={effectiveViewMode}
                  selectedDayIndex={selectedDayIndex}
                  onSlotClick={(slot) => {
                    console.log('Slot clicked:', slot);
                  }}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}