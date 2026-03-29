import { TrendingUp, TrendingDown } from "lucide-react";
import { formatCurrency, formatCompactCurrency } from "@/lib/formatters";

interface KpiCardProps {
  label: string;
  value: number;
  change?: number;
  color: 'gold' | 'green' | 'red' | 'cyan';
  compact?: boolean;
}

const colorMap = {
  gold: { bg: 'rgba(201,168,76,0.08)', border: 'rgba(201,168,76,0.2)', text: '#E8C97A', badge: 'rgba(201,168,76,0.15)' },
  green: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', text: '#10B981', badge: 'rgba(16,185,129,0.15)' },
  red: { bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.2)', text: '#F43F5E', badge: 'rgba(244,63,94,0.15)' },
  cyan: { bg: 'rgba(45,212,191,0.08)', border: 'rgba(45,212,191,0.2)', text: '#2DD4BF', badge: 'rgba(45,212,191,0.15)' },
};

export function KpiCard({ label, value, change, color, compact }: KpiCardProps) {
  const c = colorMap[color];
  const isPositive = (change ?? 0) >= 0;

  return (
    <div
      className="rounded-2xl p-5 transition-all duration-200 hover:shadow-lg"
      style={{
        background: `linear-gradient(135deg, ${c.bg}, #0D1318)`,
        border: `1px solid ${c.border}`,
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      }}
    >
      <p className="font-mono text-xs uppercase tracking-wider" style={{ color: '#94A3B8' }}>
        {label}
      </p>
      <p className="font-mono text-[28px] font-medium mt-1" style={{ color: c.text }}>
        {compact ? formatCompactCurrency(value) : formatCurrency(value)}
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
