/**
 * KitnetGrid — componente compartilhado
 * Usado em KitnetsPage (admin) e ManagerKitnetsPage (portal)
 * Única fonte de verdade para o layout dos cards de kitnet.
 */
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { WtBadge } from "@/components/wt7/WtBadge";
import { GoldButton } from "@/components/wt7/GoldButton";
import { formatCurrency } from "@/lib/formatters";
import type { Tables } from "@/integrations/supabase/types";

const statusLabels: Record<string, { label: string; variant: "green" | "gold" | "red" }> = {
  occupied:    { label: "Ocupada",     variant: "green" },
  maintenance: { label: "Manutenção",  variant: "gold"  },
  vacant:      { label: "Vaga",        variant: "red"   },
};

interface KitnetGridProps {
  kitnets:      Tables<"kitnets">[];
  onManage:     (k: Tables<"kitnets">) => void;
  entries:      any[];
  prevEntries:  any[];
  monthStatuses: Record<string, string>;
  monthDataMap:  Record<string, any>;
  alertsMap:     Record<string, number>;
  /** Admin: passa isLocked para desabilitar botão. Manager: sempre false */
  isLocked?: boolean;
}

export function KitnetGrid({
  kitnets,
  onManage,
  entries,
  prevEntries,
  monthStatuses,
  monthDataMap,
  alertsMap,
  isLocked = false,
}: KitnetGridProps) {
  if (!kitnets.length) {
    return <p className="text-muted-foreground text-sm">Nenhuma kitnet cadastrada.</p>;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {kitnets.map(k => {
        const fechamento    = entries.find(e => e.kitnet_id === k.id);
        const effectiveStatus = monthStatuses[k.id] ?? k.status ?? "vacant";
        const isOccupied    = effectiveStatus === "occupied" || effectiveStatus === "maintenance";
        const hasEntry      = !!fechamento;
        const isReconciled  = !!fechamento?.reconciled;

        const s = isOccupied
          ? (hasEntry ? statusLabels.occupied : { label: "Aguardando", variant: "gold" as const })
          : statusLabels[effectiveStatus] ?? statusLabels.vacant;

        const md            = monthDataMap[k.id];
        const effectiveName  = md?.tenant_name  ?? k.tenant_name;
        const effectivePhone = md?.tenant_phone ?? k.tenant_phone;
        const effectiveRent  = md?.rent_value   ?? k.rent_value ?? 0;

        const isZeroEntry   = hasEntry && isOccupied && (fechamento.total_liquid ?? 1) <= 0;
        const prevFechamento = prevEntries.find(e => e.kitnet_id === k.id);
        const prevWasZero   = !hasEntry && isOccupied && !!prevFechamento && (prevFechamento.total_liquid ?? 0) <= 0;
        const pendingAmount = alertsMap[k.id] ?? 0;

        const tenantName    = isOccupied ? (effectiveName || null) : null;
        const displayValue  = isOccupied ? (fechamento?.total_liquid ?? effectiveRent) : effectiveRent;

        return (
          <PremiumCard key={k.id} className="relative p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-sm font-medium text-foreground">{k.code}</span>
              <WtBadge variant={s.variant}>{s.label}</WtBadge>
            </div>

            <p className="text-sm text-muted-foreground truncate">{tenantName || "—"}</p>
            {effectivePhone && isOccupied && (
              <p className="text-xs text-muted-foreground">{effectivePhone}</p>
            )}
            <p className="font-mono text-lg mt-1" style={{ color: (!isOccupied || !hasEntry) ? '#4A5568' : '#E2E8F0' }}>
              {formatCurrency(displayValue)}
            </p>

            {/* Sub-badge: conciliado / lançado / aguardando / vaga */}
            {isOccupied && isReconciled ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg mt-1" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <span style={{ color: '#10B981' }}>✓</span>
                <span className="text-xs font-medium" style={{ color: '#10B981' }}>
                  Conciliado · {formatCurrency(fechamento.total_liquid ?? 0)}
                </span>
              </div>
            ) : isOccupied && hasEntry ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg mt-1" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
                <span className="text-xs font-medium" style={{ color: '#FBB724' }}>
                  ⏳ Lançado · {formatCurrency(fechamento.total_liquid ?? 0)}
                </span>
              </div>
            ) : isOccupied ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg mt-1" style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}>
                <span className="text-xs font-medium" style={{ color: '#C9A84C' }}>⏳ Aguardando fechamento</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg mt-1" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
                <span className="text-xs" style={{ color: '#F43F5E' }}>— Vaga</span>
              </div>
            )}

            {/* Badge: fechamento zerado neste mês → cobrança pendente no próximo */}
            {isZeroEntry && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg mt-1" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)' }}>
                <span className="text-xs font-semibold" style={{ color: '#F59E0B' }}>⚠ Saldo a cobrar no próx. mês</span>
              </div>
            )}

            {/* Badge: mês anterior zerado OU alerta pendente → cobrar agora */}
            {(prevWasZero || pendingAmount > 0) && !isZeroEntry && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg mt-1" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)' }}>
                <span className="text-xs font-semibold" style={{ color: '#F59E0B' }}>
                  ⚠ {pendingAmount > 0 ? `Pendente: ${formatCurrency(pendingAmount)}` : "Saldo pendente do mês anterior"}
                </span>
              </div>
            )}

            <GoldButton
              className="w-full text-xs justify-center mt-2"
              onClick={() => onManage(k)}
              disabled={isLocked}
              title={isLocked ? "🔒 Mês fechado" : undefined}
              style={isLocked ? { opacity: 0.35, cursor: 'not-allowed', filter: 'grayscale(0.6)' } : undefined}
            >
              {isLocked ? "🔒 Fechado" : "Gerenciar"}
            </GoldButton>
          </PremiumCard>
        );
      })}
    </div>
  );
}
