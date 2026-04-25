import { useMemo, useState } from "react";
import { Sparkles, Check, X, Search, ChevronRight, AlertCircle, Inbox } from "lucide-react";
import { useUnreconciledCredits, useTenantHistory, useApplySuggestion, useIgnoreCredit } from "@/hooks/useUnreconciledCredits";
import { suggestForCredit, type CreditSuggestion } from "@/lib/suggestForCredit";
import { getAllPatterns } from "@/lib/patternLearning";
import { useQuery } from "@tanstack/react-query";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toast } from "sonner";

interface Props {
  month: string;
}

const CONFIDENCE_META = {
  high:   { color: "#10B981", bg: "rgba(16,185,129,0.15)", label: "alta" },
  medium: { color: "#E8C97A", bg: "rgba(232,201,122,0.15)", label: "média" },
  low:    { color: "#94A3B8", bg: "rgba(148,163,184,0.15)", label: "baixa" },
} as const;

export function UnreconciledCreditsTab({ month }: Props) {
  const { data: credits = [], isLoading } = useUnreconciledCredits(month);
  const { data: tenants = [] } = useTenantHistory();
  const { data: patterns = [] } = useQuery({
    queryKey: ["classification_patterns_all"],
    queryFn: () => getAllPatterns(),
  });
  const apply = useApplySuggestion();
  const ignore = useIgnoreCredit();

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!search) return credits;
    const s = search.toLowerCase();
    return credits.filter((c: any) =>
      (c.description ?? "").toLowerCase().includes(s) ||
      String(c.amount).includes(s)
    );
  }, [credits, search]);

  const total = filtered.reduce((s: number, c: any) => s + Number(c.amount ?? 0), 0);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApply = async (credit: any, sug: CreditSuggestion) => {
    try {
      await apply.mutateAsync({
        bankTxId: credit.id,
        bankTxDescription: credit.description ?? "",
        bankTxAmount: Number(credit.amount),
        bankTxDate: credit.date,
        category: sug.category,
        intent: sug.intent,
        label: sug.label,
        tenant: sug.tenant,
        kitnet_code: sug.kitnet_code,
      });
      toast.success(`✓ Vinculado como "${sug.label}"`);
      setExpanded(prev => {
        const next = new Set(prev);
        next.delete(credit.id);
        return next;
      });
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? "tente novamente"}`);
    }
  };

  const handleIgnore = async (credit: any) => {
    try {
      await ignore.mutateAsync(credit.id);
      toast.success("Marcado como ignorado");
    } catch (e: any) {
      toast.error(`Erro: ${e?.message ?? "tente novamente"}`);
    }
  };

  if (isLoading) {
    return <Skeleton className="h-[400px] rounded-2xl" style={{ background: "#0D1318" }} />;
  }

  if (credits.length === 0) {
    return (
      <PremiumCard>
        <div className="text-center py-16" style={{ color: "#4A5568" }}>
          <Inbox className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium" style={{ color: "#94A3B8" }}>
            Nenhum crédito pendente de revisão neste mês
          </p>
          <p className="text-xs mt-2">
            Todos os créditos foram conciliados (kitnet, revenue, transferência ou ignorados).
          </p>
        </div>
      </PremiumCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header — total + busca */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-xl px-3 py-2 flex items-center gap-2"
            style={{ background: "rgba(232,201,122,0.08)", border: "1px solid rgba(232,201,122,0.3)" }}>
            <AlertCircle className="w-4 h-4" style={{ color: "#E8C97A" }} />
            <span className="text-xs font-medium" style={{ color: "#E8C97A" }}>
              {filtered.length} créditos pendentes · {formatCurrency(total)}
            </span>
          </div>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#4A5568" }} />
          <Input
            placeholder="Buscar descrição ou valor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 text-xs"
            style={{ background: "#080C10", borderColor: "#1A2535", color: "#F0F4F8" }}
          />
        </div>
      </div>

      {/* Banner explicativo */}
      <div className="rounded-xl px-4 py-3 flex items-start gap-3 text-xs"
        style={{ background: "rgba(45,212,191,0.05)", border: "1px solid rgba(45,212,191,0.2)" }}>
        <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#2DD4BF" }} />
        <div className="leading-relaxed" style={{ color: "#94A3B8" }}>
          <span style={{ color: "#F0F4F8", fontWeight: 600 }}>Sistema sugere — você decide.</span>{" "}
          As sugestões abaixo são hipóteses baseadas em nome do remetente, valor histórico e padrões aprendidos.{" "}
          Confiança <span style={{ color: "#10B981" }}>alta</span> = nome de inquilino + valor exato bate.
          Confiança <span style={{ color: "#94A3B8" }}>baixa</span> = palpite. Revisão sua antes de criar receita.
        </div>
      </div>

      {/* Lista de créditos */}
      <div className="space-y-3">
        {filtered.map((credit: any) => {
          const suggestions = suggestForCredit({
            description: credit.description ?? "",
            amount: Number(credit.amount),
            date: credit.date,
            tenants,
            patterns,
          });
          const topSug = suggestions[0];
          const isExpanded = expanded.has(credit.id);

          return (
            <PremiumCard key={credit.id}>
              {/* Header do crédito */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs" style={{ color: "#94A3B8" }}>
                      {formatDate(credit.date)}
                    </span>
                    <span className="font-mono text-base font-bold" style={{ color: "#10B981" }}>
                      {formatCurrency(Number(credit.amount))}
                    </span>
                    {topSug && (
                      <WtBadge variant={topSug.confidence === "high" ? "green" : topSug.confidence === "medium" ? "gold" : "gray"}>
                        sugere: {topSug.label.slice(0, 40)}{topSug.label.length > 40 ? "…" : ""}
                      </WtBadge>
                    )}
                  </div>
                  <p className="text-xs mt-1.5" style={{ color: "#CBD5E1" }}>
                    {credit.description}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleExpand(credit.id)}
                    className="px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 transition-all"
                    style={{
                      background: isExpanded ? "rgba(232,201,122,0.2)" : "rgba(232,201,122,0.08)",
                      color: "#E8C97A",
                      border: "1px solid rgba(232,201,122,0.3)",
                    }}>
                    {isExpanded ? "Recolher" : `${suggestions.length} sugestões`}
                    <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                  </button>
                  <button
                    onClick={() => handleIgnore(credit)}
                    disabled={ignore.isPending}
                    title="Marcar como ignorado (transferência própria, erro, etc)"
                    className="p-1.5 rounded-lg disabled:opacity-50"
                    style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)" }}>
                    <X className="w-3.5 h-3.5" style={{ color: "#F43F5E" }} />
                  </button>
                </div>
              </div>

              {/* Sugestões expandidas */}
              {isExpanded && (
                <div className="space-y-2 pt-3 mt-1" style={{ borderTop: "1px solid #1A2535" }}>
                  {suggestions.map((sug, i) => {
                    const meta = CONFIDENCE_META[sug.confidence];
                    return (
                      <div
                        key={i}
                        className="rounded-lg p-3 flex items-center justify-between gap-3"
                        style={{
                          background: "rgba(13,19,24,0.5)",
                          border: `1px solid ${meta.bg.replace("0.15", "0.25")}`,
                        }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-xs font-medium" style={{ color: "#F0F4F8" }}>
                              {sug.label}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold"
                              style={{ background: meta.bg, color: meta.color }}>
                              {meta.label}
                            </span>
                          </div>
                          <p className="text-[11px]" style={{ color: "#94A3B8" }}>
                            {sug.hint}
                          </p>
                        </div>
                        <button
                          onClick={() => handleApply(credit, sug)}
                          disabled={apply.isPending}
                          className="px-3 py-1.5 text-xs rounded-lg flex items-center gap-1 disabled:opacity-50 flex-shrink-0"
                          style={{
                            background: "rgba(16,185,129,0.15)",
                            color: "#10B981",
                            border: "1px solid rgba(16,185,129,0.3)",
                          }}>
                          <Check className="w-3.5 h-3.5" /> Vincular
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </PremiumCard>
          );
        })}
      </div>
    </div>
  );
}
