import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays } from "lucide-react";
import { ptBR } from "date-fns/locale";

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

function parseDate(value: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function formatDisplay(value: string): string {
  const d = parseDate(value);
  if (!d) return "";
  return d.toLocaleDateString("pt-BR");
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function DatePicker({ value, onChange, className = "", placeholder = "Selecionar data" }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDate(value);
  const label = value ? formatDisplay(value) : placeholder;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-background text-sm text-foreground hover:border-[#E8C97A]/50 transition-colors w-full text-left ${className}`}
        >
          <CalendarDays className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className={value ? "text-foreground" : "text-muted-foreground"}>{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (date) { onChange(toISODate(date)); setOpen(false); }
          }}
          defaultMonth={selected ?? new Date()}
          locale={ptBR}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
