interface LegendItem {
  color: string;
  label: string;
  icon: string;
}

const legendItems: LegendItem[] = [
  { color: 'bg-emerald-500/30 border-emerald-500', label: 'Disp.', icon: '✓' },
  { color: 'bg-red-500/30 border-red-500', label: 'Ocup.', icon: '●' },
  { color: 'bg-amber-500/30 border-amber-500', label: 'Pausa', icon: 'P' },
  { color: 'bg-orange-500/30 border-orange-500', label: 'Férias', icon: '✕' },
  { color: 'bg-muted border-muted-foreground/30', label: 'Fech.', icon: '—' },
];

export function AgendaLegend() {
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4 py-2 px-2 bg-muted/20 rounded-lg">
      {legendItems.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div className={cn(
            'w-5 h-5 rounded border flex items-center justify-center text-[10px] font-medium',
            item.color
          )}>
            {item.icon}
          </div>
          <span className="text-[11px] text-muted-foreground font-medium">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}