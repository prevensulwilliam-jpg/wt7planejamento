import { useState, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MONTHS_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DAYS_HEADER = ["D","S","T","Q","Q","S","S"];

function parseISO(v: string): Date | null {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function displayBR(v: string): string {
  const d = parseISO(v);
  if (!d) return "";
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

function parseBR(s: string): string | null {
  const clean = s.replace(/\D/g, "");
  if (clean.length !== 8) return null;
  const d = parseInt(clean.slice(0,2));
  const m = parseInt(clean.slice(2,4));
  const y = parseInt(clean.slice(4,8));
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  const date = new Date(y, m-1, d);
  if (date.getMonth() !== m-1) return null; // dia inválido (ex: 31/02)
  return toISO(date);
}

function maskBR(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0,2)}/${d.slice(2)}`;
  return `${d.slice(0,2)}/${d.slice(2,4)}/${d.slice(4)}`;
}

function calendarDays(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1).getDay(); // 0=dom
  const total = new Date(year, month+1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let i = 1; i <= total; i++) cells.push(i);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const inputStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  outline: "none",
  color: "#F0F4F8",
  fontSize: 13,
  width: "100%",
  fontFamily: "inherit",
};

const baseBtn: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer", padding: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
};

export function DatePicker({ value, onChange, className = "", placeholder = "Selecionar data" }: DatePickerProps) {
  const [open, setOpen]         = useState(false);
  const [typed, setTyped]       = useState("");        // texto do input
  const [editMode, setEditMode] = useState(false);     // se o input está em foco

  const today = new Date();
  const sel   = parseISO(value);
  const [viewYear,  setViewYear]  = useState(sel?.getFullYear()  ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(sel?.getMonth()     ?? today.getMonth());
  const [yearEdit,  setYearEdit]  = useState(false);  // edição rápida do ano
  const inputRef = useRef<HTMLInputElement>(null);

  // sincronizar viewMonth/Year quando value muda externamente
  useEffect(() => {
    if (sel) { setViewYear(sel.getFullYear()); setViewMonth(sel.getMonth()); }
  }, [value]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); }
    else setViewMonth(m => m-1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); }
    else setViewMonth(m => m+1);
  };

  const selectDay = (day: number) => {
    const iso = toISO(new Date(viewYear, viewMonth, day));
    onChange(iso);
    setOpen(false);
    setEditMode(false);
  };

  // ── input de digitação ──
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskBR(e.target.value);
    setTyped(masked);
    const iso = parseBR(masked.replace(/\D/g,"").length === 8 ? masked : "");
    if (iso) {
      onChange(iso);
      const d = parseISO(iso)!;
      setViewYear(d.getFullYear()); setViewMonth(d.getMonth());
    }
  };

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { setOpen(false); setEditMode(false); }
    if (e.key === "Escape") { setOpen(false); setEditMode(false); }
  };

  const openAndFocusInput = () => {
    setTyped(value ? displayBR(value) : "");
    setEditMode(true);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cells = calendarDays(viewYear, viewMonth);
  const todayISO = toISO(today);

  return (
    <Popover open={open} onOpenChange={v => { setOpen(v); if (!v) setEditMode(false); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 h-10 px-3 rounded-md border border-border bg-background text-sm hover:border-[#E8C97A]/50 transition-colors w-full text-left ${className}`}
          onClick={openAndFocusInput}
        >
          <CalendarDays className="w-4 h-4 shrink-0" style={{ color: '#64748B' }} />
          {editMode ? (
            <input
              ref={inputRef}
              value={typed}
              onChange={onInputChange}
              onKeyDown={onInputKeyDown}
              onClick={e => e.stopPropagation()}
              placeholder="DD/MM/AAAA"
              style={inputStyle}
              maxLength={10}
            />
          ) : (
            <span style={{ color: value ? '#F0F4F8' : '#64748B' }}>
              {value ? displayBR(value) : placeholder}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="p-0"
        style={{ background: '#0D1318', border: '1px solid #1A2535', borderRadius: 12, width: 260 }}
        align="start"
        onOpenAutoFocus={e => e.preventDefault()}
      >
        {/* ── Cabeçalho de navegação ── */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2" style={{ borderBottom: '1px solid #1A2535' }}>
          <button style={baseBtn} onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" style={{ color: '#64748B' }} />
          </button>

          <div className="flex items-center gap-2">
            {/* Mês — clicável para ir ao picker de meses */}
            <select
              value={viewMonth}
              onChange={e => setViewMonth(Number(e.target.value))}
              style={{ background: 'transparent', border: 'none', color: '#F0F4F8', fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none' }}
            >
              {MONTHS_FULL.map((m, i) => <option key={i} value={i} style={{ background: '#0D1318' }}>{m}</option>)}
            </select>

            {/* Ano — editável por clique */}
            {yearEdit ? (
              <input
                autoFocus
                type="number"
                value={viewYear}
                onChange={e => setViewYear(Number(e.target.value))}
                onBlur={() => setYearEdit(false)}
                onKeyDown={e => e.key === "Enter" && setYearEdit(false)}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #1A2535', color: '#E8C97A', fontSize: 13, fontWeight: 700, borderRadius: 6, width: 60, textAlign: 'center', outline: 'none', padding: '1px 4px' }}
              />
            ) : (
              <button
                onClick={() => setYearEdit(true)}
                style={{ ...baseBtn, color: '#E8C97A', fontSize: 13, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'rgba(232,201,122,0.08)' }}
              >
                {viewYear}
              </button>
            )}
          </div>

          <button style={baseBtn} onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" style={{ color: '#64748B' }} />
          </button>
        </div>

        {/* ── Atalhos de mês ── */}
        <div className="grid grid-cols-6 gap-0.5 px-2 pt-2 pb-1">
          {MONTHS.map((m, i) => (
            <button
              key={i}
              onClick={() => setViewMonth(i)}
              style={{
                fontSize: 9, padding: '2px 0', borderRadius: 4, border: 'none', cursor: 'pointer',
                background: viewMonth === i ? 'rgba(232,201,122,0.15)' : 'transparent',
                color: viewMonth === i ? '#E8C97A' : '#64748B',
                fontWeight: viewMonth === i ? 700 : 400,
              }}
            >
              {m}
            </button>
          ))}
        </div>

        {/* ── Grade de dias ── */}
        <div className="px-2 pb-3">
          <div className="grid grid-cols-7 mb-1">
            {DAYS_HEADER.map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 10, color: '#4A5568', fontWeight: 600, padding: '2px 0' }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const iso = toISO(new Date(viewYear, viewMonth, day));
              const isSel   = iso === value;
              const isToday = iso === todayISO;
              return (
                <button
                  key={i}
                  onClick={() => selectDay(day)}
                  style={{
                    fontSize: 12, padding: '5px 0', borderRadius: 6, border: 'none',
                    cursor: 'pointer', textAlign: 'center', fontWeight: isSel ? 700 : 400,
                    background: isSel ? 'rgba(232,201,122,0.25)' : 'transparent',
                    color: isSel ? '#E8C97A' : isToday ? '#2DD4BF' : '#CBD5E1',
                    outline: isToday && !isSel ? '1px solid rgba(45,212,191,0.3)' : 'none',
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Input de digitação no rodapé ── */}
        <div style={{ borderTop: '1px solid #1A2535', padding: '8px 12px' }}>
          <div className="flex items-center gap-2" style={{ background: '#080C10', border: '1px solid #1A2535', borderRadius: 8, padding: '6px 10px' }}>
            <span style={{ fontSize: 11, color: '#4A5568' }}>✏</span>
            <input
              value={editMode ? typed : (value ? displayBR(value) : "")}
              onChange={onInputChange}
              onFocus={() => { setEditMode(true); setTyped(value ? displayBR(value) : ""); }}
              onKeyDown={onInputKeyDown}
              placeholder="DD/MM/AAAA"
              maxLength={10}
              style={{ ...inputStyle, fontSize: 12 }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
