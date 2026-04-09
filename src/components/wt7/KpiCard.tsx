import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatCompactCurrency } from "@/lib/formatters";

interface KpiCardProps {
  label: string;
  value: number;
  change?: number;
  color: 'gold' | 'green' | 'red' | 'cyan' | 'gray';
  compact?: boolean;
  formatAs?: 'currency' | 'number';
  onClick?: () => void;
}

const colorMap = {
  gold: { bg: 'rgba(201,168,76,0.08)', border: 'rgba(201,168,76,0.2)', text: '#E8C97A', badge: 'rgba(201,168,76,0.15)' },
  green: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', text: '#10B981', badge: 'rgba(16,185,129,0.15)' },
  red: { bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.2)', text: '#F43F5E', badge: 'rgba(244,63,94,0.15)' },
  cyan: { bg: 'rgba(45,212,191,0.08)', border: 'rgba(45,212,191,0.2)', text: '#2DD4BF', badge: 'rgba(45,212,191,0.15)' },
  gray: { bg: 'rgba(74,85,104,0.08)', border: 'rgba(74,85,104,0.2)', text: '#94A3B8', badge: 'rgba(74,85,104,0.15)' },
};

export function KpiCard({ label, value, change, color, compact, formatAs = 'currency', onClick }: KpiCardProps) {
  const c = colorMap[color];
  const isPositive = (change ?? 0) >= 0;

  const displayValue = formatAs === 'number'
    ? value.toLocaleString('pt-BR')
    : compact ? formatCompactCurrency(value) : formatCurrency(value);

  return (
    <div
      className={`rounded-2xl p-5 transition-all duration-200 hover:shadow-lg ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
      style={{
        background: `linear-gradient(135deg, ${c.bg}, #0D1318)`,
        border: `1px solid ${c.border}`,
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <p className="font-mono text-xs uppercase tracking-wider" style={{ color: '#94A3B8' }}>
        {label}
      </p>
      <p className="font-mono text-[28px] font-medium mt-1" style={{ color: c.text }}>
        {displayValue}
      </p>
      {change !== undefined && (
        <div className="flex items-center gap-1 mt-2">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium font-mono"
            style={{ background: isPositive ? colorMap.green.badge : colorMap.red.badge, color: isPositive ? colorMap.green.text : colorMap.red.text }}
          >
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? '+' : ''}{change.toFixed(1)}%
          </span>
          <span className="text-xs" style={{ color: '#4A5568' }}>vs mês ant.</span>
        </div>
      )}
    </div>
  );
}
