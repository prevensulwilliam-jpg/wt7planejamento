/**
 * KitnetVisaoGeral — fonte única de verdade para a aba Visão Geral de kitnets.
 * Usado em KitnetsPage (admin) e ManagerKitnetsPage (Portal Administrador).
 */
import { useState } from "react";
import { Printer } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthPicker } from "@/components/wt7/MonthPicker";
import { KpiCard } from "@/components/wt7/KpiCard";
import { KitnetGrid } from "@/components/wt7/KitnetGrid";
import { KitnetModal } from "@/components/wt7/KitnetModal";
import {
  useKitnets, useKitnetEntries, useKitnetSummary,
  usePrevMonth, useKitnetAlertsForMonth,
  useKitnetMonthStatuses, useKitnetMonthDataMap,
} from "@/hooks/useKitnets";
import { abrirReciboConsolidado } from "@/lib/relatorioFechamento";
import type { AlertInfo } from "@/components/wt7/KitnetGrid";
import type { Tables } from "@/integrations/supabase/types";

interface KitnetVisaoGeralProps {
  month: string;
  /** Se fornecido, exibe MonthPicker na barra superior */
  onMonthChange?: (v: string) => void;
  /** Exibe botão "Relatório do Mês" */
  showRelatorio?: boolean;
  /** Bloqueia botão Gerenciar nos cards */
  isLocked?: boolean;
  /** Passa disableLock para o KitnetModal (Portal Administrador) */
  disableLock?: boolean;
}

export function KitnetVisaoGeral({
  month,
  onMonthChange,
  showRelatorio = false,
  isLocked = false,
  disableLock = false,
}: KitnetVisaoGeralProps) {
  const { data: kitnets, isLoading, refetch } = useKitnets();
  const summary       = useKitnetSummary(month);
  const { data: entries }     = useKitnetEntries(month);
  const prevMonth             = usePrevMonth(month);
  const { data: prevEntries } = useKitnetEntries(prevMonth);
  const { data: monthStatuses } = useKitnetMonthStatuses(month);
  const { data: monthDataMap }  = useKitnetMonthDataMap(month);
  const { data: rawAlerts }     = useKitnetAlertsForMonth(month);
  const [selected, setSelected] = useState<Tables<"kitnets"> | null>(null);

  const alertsMap = (rawAlerts ?? []).reduce<Record<string, AlertInfo>>((acc, a: any) => {
    acc[a.kitnet_id] = { id: a.id, amount: a.pending_amount, confirmed: a.confirmed ?? null, source_month: a.source_month };
    return acc;
  }, {});

  const rwt02 = (kitnets ?? []).filter(k => k.residencial_code === "RWT02");
  const rwt03 = (kitnets ?? []).filter(k => k.residencial_code === "RWT03");
  const complexos = [
    { label: "RWT02 — Rua Amauri de Souza, 08", units: rwt02 },
    { label: "RWT03 — Rua Manoel Corrêa, 125",  units: rwt03 },
  ].filter(c => c.units.length > 0);

  const handleRelatorio = () => {
    if (!entries?.length) return;
    const data = entries.filter((e: any) => e.kitnets).map((e: any) => ({ kitnet: e.kitnets, fechamento: e }));
    abrirReciboConsolidado(data, month);
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Barra superior: MonthPicker + Relatório */}
      {(onMonthChange || showRelatorio) && (
        <div className="flex items-center gap-3 flex-wrap">
          {onMonthChange && (
            <>
              <span className="text-xs font-mono uppercase tracking-widest" style={{ color: '#4A5568' }}>
                Mês de referência
              </span>
              <MonthPicker value={month} onChange={onMonthChange} className="w-40" />
            </>
          )}
          {showRelatorio && (
            <button
              onClick={handleRelatorio}
              disabled={!entries?.length}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
              style={{ background: 'rgba(232,201,122,0.1)', color: '#E8C97A', border: '1px solid rgba(232,201,122,0.3)' }}
              title={entries?.length ? `Gerar relatório com ${entries.length} fechamentos` : "Nenhum fechamento neste mês"}
            >
              <Printer className="w-4 h-4" />
              Relatório do Mês
            </button>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Recebido" value={summary.totalReceived} color="gold" />
        <div className="rounded-2xl p-4 space-y-1" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <p className="text-xs uppercase font-mono tracking-widest" style={{ color: '#94A3B8' }}>Ocupadas</p>
          <p className="font-mono text-2xl font-bold" style={{ color: '#10B981' }}>
            {summary.occupied}<span className="text-sm font-normal" style={{ color: '#4A5568' }}>/{summary.total}</span>
          </p>
        </div>
        <div className="rounded-2xl p-4 space-y-1" style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <p className="text-xs uppercase font-mono tracking-widest" style={{ color: '#94A3B8' }}>Conciliados</p>
          <p className="font-mono text-2xl font-bold" style={{ color: '#2DD4BF' }}>
            {summary.received}<span className="text-sm font-normal" style={{ color: '#4A5568' }}>/{summary.totalEntries}</span>
          </p>
          <p className="text-xs" style={{ color: '#4A5568' }}>conciliados / lançamentos</p>
        </div>
        <KpiCard label="Vacâncias" value={summary.vacant} color="red" compact formatAs="number" />
      </div>

      {/* Grids por complexo */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 13 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : (
        complexos.map(({ label, units }) => (
          <div key={label}>
            <h2 className="font-display font-bold text-lg text-foreground mb-3">{label}</h2>
            <KitnetGrid
              kitnets={units}
              onManage={setSelected}
              entries={entries as any[] ?? []}
              prevEntries={prevEntries ?? []}
              monthStatuses={monthStatuses ?? {}}
              monthDataMap={monthDataMap ?? {}}
              alertsMap={alertsMap}
              isLocked={isLocked}
            />
          </div>
        ))
      )}

      {selected && (
        <KitnetModal
          kitnet={selected}
          onClose={() => setSelected(null)}
          onUpdated={() => refetch()}
          defaultMonth={month}
          disableLock={disableLock}
        />
      )}
    </div>
  );
}
