import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface MonthPickerProps {
  value: string; // YYYY-MM
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function MonthPicker({ value, onChange, className = "", placeholder = "Selecionar mês" }: MonthPickerProps) {
  const [open, setOpen] = useState(false);

  const parsed = value ? { year: parseInt(value.slice(0, 4)), month: parseInt(value.slice(5, 7)) - 1 } : null;
  const [navYear, setNavYear] = useState(parsed?.year ?? new Date().getFullYear());

  const label = parsed
    ? `${MONTHS_FULL[parsed.month]} de ${parsed.year}`
    : placeholder;

  const handleSelect = (monthIndex: number) => {
    const mm = String(monthIndex + 1).padStart(2, "0");
    onChange(`${navYear}-${mm}`);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-background text-sm font-mono text-foreground hover:border-[#E8C97A]/50 transition-colors w-full text-left ${className}`}
        >
          <CalendarDays className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className={parsed ? "text-foreground" : "text-muted-foreground"}>{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 bg-card border-border" align="start">
        {/* Year navigation */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => setNavYear(y => y - 1)}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-foreground text-sm">{navYear}</span>
          <button
            type="button"
            onClick={() => setNavYear(y => y + 1)}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-3 gap-1.5">
          {MONTHS.map((m, i) => {
            const isSelected = parsed?.year === navYear && parsed?.month === i;
            return (
              <button
                key={m}
                type="button"
                onClick={() => handleSelect(i)}
                className={`py-2 px-1 rounded-md text-sm font-medium transition-colors ${
                  isSelected
                    ? "text-background font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                style={isSelected ? { background: '#E8C97A' } : {}}
              >
                {m}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
