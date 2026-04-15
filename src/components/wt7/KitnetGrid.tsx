/**
 * KitnetGrid — componente compartilhado
 * Usado em KitnetsPage (admin) e ManagerKitnetsPage (portal)
 * Única fonte de verdade para o layout dos cards de kitnet.
 */
import { useState } from "react";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { WtBadge } from "@/components/wt7/WtBadge";
import { GoldButton } from "@/components/wt7/GoldButton";
import { formatCurrency } from "@/lib/formatters";
import { useConfirmAlert } from "@/hooks/useKitnets";
import type { Tables } from "@/integrations/supabase/types";

const statusLabels: Record<string, { label: string; variant: "green" | "gold" | "red" }> = {
  occupied:    { label: "Ocupada",     variant: "green" },
  maintenance: { label: "Manutenção",  variant: "gold"  },
  vacant:      { label: "Vaga",        variant: "red"   },
};

export type AlertInfo = {
  id: string;
  amount: number;
  confirmed: boolean | null;
  source_month?: string;
};

interface KitnetGridProps {
  kitnets:      Tables<"kitnets">[];
  onManage:     (k: Tables<"kitnets">) => void;
  entries:      any[];
  prevEntries:  any[];
  monthStatuses: Record<string, string>;
  monthDataMap:  Record<string, any>;
  alertsMap:     Record<string, AlertInfo>;
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
  const [dlg, setDlg] = useState<{ info: AlertInfo; code: string } | null>(null);
  const confirmAlert = useConfirmAlert();

  const handleConfirm = async (confirmed: boolean) => {
    if (!dlg) return;
    await confirmAlert.mutateAsync({ id: dlg.info.id, confirmed });
    setDlg(null);
  };

  if (!kitnets.length) {
    return <p className="text-muted-foreground text-sm">Nenhuma kitnet cadastrada.</p>;
  }

  const isRevertDialog = dlg?.info.confirmed === true;

  return (
    <>
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

          const alertInfo     = alertsMap[k.id];
          const pendingAmount = alertInfo?.amount ?? 0;

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

              {/* Badge: mês anterior zerado SEM alerta → aviso simples */}
              {prevWasZero && !alertInfo && !isZeroEntry && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg mt-1" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)' }}>
                  <span className="text-xs font-semibold" style={{ color: '#F59E0B' }}>⚠ Saldo pendente do mês anterior</span>
                </div>
              )}

              {/* Badge: alerta com confirmação interativa */}
              {alertInfo && !isZeroEntry && (
                alertInfo.confirmed === true ? (
                  <button
                    className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg mt-1 text-left transition-all"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', cursor: 'pointer' }}
                    onClick={() => setDlg({ info: alertInfo, code: k.code })}
                  >
                    <span className="text-xs font-semibold" style={{ color: '#10B981' }}>
                      ✓ Acordo incluído · {formatCurrency(alertInfo.amount)}
                    </span>
                  </button>
                ) : (
                  <button
                    className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg mt-1 text-left transition-all"
                    style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', cursor: 'pointer' }}
                    onClick={() => setDlg({ info: alertInfo, code: k.code })}
                  >
                    <span className="text-xs font-semibold" style={{ color: '#F59E0B' }}>
                      ⚠ {alertInfo.confirmed === false ? 'Ainda pendente' : 'Pendente'}: {formatCurrency(alertInfo.amount)}
                    </span>
                    <span className="ml-auto text-xs opacity-60" style={{ color: '#F59E0B' }}>confirmar →</span>
                  </button>
                )
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

      {/* Dialog de confirmação */}
      {dlg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setDlg(null); }}
        >
          <div
            className="rounded-2xl p-7 w-[360px] animate-in zoom-in-95 duration-150"
            style={{ background: '#0D1318', border: '1px solid #1A2535' }}
          >
            <div className="text-2xl mb-3">{isRevertDialog ? '✅' : '📋'}</div>
            <h3 className="text-base font-bold mb-1.5" style={{ color: '#F0F4F8' }}>
              {isRevertDialog ? 'Acordo já registrado' : 'Acordo incluído no fechamento?'}
            </h3>
            <p className="text-sm mb-5 leading-relaxed" style={{ color: '#94A3B8' }}>
              {isRevertDialog ? (
                <>O valor de <strong style={{ color: '#E8C97A' }}>{formatCurrency(dlg.info.amount)}</strong> foi confirmado como incluído no fechamento. Deseja reverter para pendente?</>
              ) : (
                <>O valor de <strong style={{ color: '#E8C97A' }}>{formatCurrency(dlg.info.amount)}</strong> referente ao acordo foi adicionado ao fechamento deste mês?</>
              )}
            </p>
            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all"
                style={{ background: 'transparent', color: '#64748B', border: '1px solid #1A2535' }}
                onClick={() => setDlg(null)}
              >
                {isRevertDialog ? 'Fechar' : 'Cancelar'}
              </button>
              {isRevertDialog ? (
                <button
                  className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: 'rgba(244,63,94,0.1)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.3)' }}
                  onClick={() => handleConfirm(false)}
                  disabled={confirmAlert.isPending}
                >
                  Reverter para pendente
                </button>
              ) : (
                <>
                  <button
                    className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{ background: 'rgba(244,63,94,0.1)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.3)' }}
                    onClick={() => handleConfirm(false)}
                    disabled={confirmAlert.isPending}
                  >
                    Não, ainda pendente
                  </button>
                  <button
                    className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.35)' }}
                    onClick={() => handleConfirm(true)}
                    disabled={confirmAlert.isPending}
                  >
                    Sim, foi incluído ✓
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
