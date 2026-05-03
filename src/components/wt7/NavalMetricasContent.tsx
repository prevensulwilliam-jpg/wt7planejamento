/**
 * NavalMetricasContent — conteúdo do dashboard de métricas Naval.
 *
 * Reusável: usado tanto na página `/naval/metricas` quanto na tab "Métricas"
 * dentro de `/naval`. Sem header de página (cada wrapper renderiza o seu).
 *
 * Métricas:
 *   - Custo R$/mês (Sonnet + Haiku, com cache)
 *   - Total de chamadas (último mês)
 *   - % Sonnet vs Haiku (preciso desde v44)
 *   - Tokens médios por chamada
 *   - Cache hit ratio
 *   - Tools mais usadas
 *
 * Fonte: tabela naval_chats (incl. model_used + cost_usd_estimated em v44+).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Activity, TrendingUp, Zap, AlertTriangle, ExternalLink, RefreshCw, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavalCostSettings, useUpdateNavalCostSettings } from "@/hooks/useNavalCostSettings";

// Tarifas Anthropic em USD/M tokens (fallback pra chats antigos sem cost_usd_estimated)
const ANTHROPIC_PRICES_USD_PER_M = {
  haiku:  { input: 1.0, cache_read: 0.10, cache_write: 1.25, output: 5.0 },
  sonnet: { input: 3.0, cache_read: 0.30, cache_write: 3.75, output: 15.0 },
};

interface NavalChat {
  id: string;
  asked_at: string;
  tokens_in: number | null;
  tokens_out: number | null;
  tokens_cache_read: number | null;
  tokens_cache_write: number | null;
  tools_used: string[] | null;
  version: string | null;
  question: string;
  model_used: "haiku" | "sonnet" | null;
  cost_usd_estimated: number | null;
}

function inferModelLegacy(version: string | null): "sonnet" | "haiku" {
  if (!version) return "haiku";
  const v = version.toLowerCase();
  if (v.includes("v40") || v.includes("v41") || v.includes("v42") || v.includes("v43")) return "sonnet";
  return "haiku";
}

function calcCostUSD(chat: NavalChat): number {
  if (chat.cost_usd_estimated != null) return chat.cost_usd_estimated;
  const model = chat.model_used ?? inferModelLegacy(chat.version);
  const rates = ANTHROPIC_PRICES_USD_PER_M[model];
  const input = ((chat.tokens_in ?? 0) / 1_000_000) * rates.input;
  const cacheRead = ((chat.tokens_cache_read ?? 0) / 1_000_000) * rates.cache_read;
  const cacheWrite = ((chat.tokens_cache_write ?? 0) / 1_000_000) * rates.cache_write;
  const output = ((chat.tokens_out ?? 0) / 1_000_000) * rates.output;
  return input + cacheRead + cacheWrite + output;
}

function getEffectiveModel(chat: NavalChat): "haiku" | "sonnet" {
  return chat.model_used ?? inferModelLegacy(chat.version);
}

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function formatUSD(v: number): string {
  return `US$ ${v.toFixed(2)}`;
}

function timeSince(iso: string | null): string {
  if (!iso) return "nunca";
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "agora";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min atrás`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h atrás`;
  return `${Math.floor(seconds / 86400)}d atrás`;
}

export function NavalMetricasContent() {
  const { toast } = useToast();
  const { data: settings } = useNavalCostSettings();
  const updateSettings = useUpdateNavalCostSettings();
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState({
    usd_to_brl: "",
    anthropic_balance_usd: "",
    anthropic_mtd_cost_usd: "",
    anthropic_mtd_cost_total_usd: "",
  });

  const usdToBrl = settings?.usd_to_brl ?? 5.0;

  const handleStartEdit = () => {
    setDraft({
      usd_to_brl: settings?.usd_to_brl?.toString() ?? "5.0",
      anthropic_balance_usd: settings?.anthropic_balance_usd?.toString() ?? "",
      anthropic_mtd_cost_usd: settings?.anthropic_mtd_cost_usd?.toString() ?? "",
      anthropic_mtd_cost_total_usd: settings?.anthropic_mtd_cost_total_usd?.toString() ?? "",
    });
    setEditMode(true);
  };

  const handleSaveSettings = async () => {
    try {
      await updateSettings.mutateAsync({
        usd_to_brl: parseFloat(draft.usd_to_brl) || 5.0,
        anthropic_balance_usd: draft.anthropic_balance_usd ? parseFloat(draft.anthropic_balance_usd) : null,
        anthropic_mtd_cost_usd: draft.anthropic_mtd_cost_usd ? parseFloat(draft.anthropic_mtd_cost_usd) : null,
        anthropic_mtd_cost_total_usd: draft.anthropic_mtd_cost_total_usd ? parseFloat(draft.anthropic_mtd_cost_total_usd) : null,
      });
      toast({ title: "Calibragem salva" });
      setEditMode(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const { data: chats, isLoading } = useQuery({
    queryKey: ["naval_metricas_30d"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await (supabase as any)
        .from("naval_chats")
        .select("id, asked_at, tokens_in, tokens_out, tokens_cache_read, tokens_cache_write, tools_used, version, question, model_used, cost_usd_estimated")
        .gte("asked_at", since.toISOString())
        .order("asked_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NavalChat[];
    },
  });

  const stats = useMemo(() => {
    const list = chats ?? [];
    if (list.length === 0) {
      return {
        total_chats: 0, cost_total: 0, cost_total_usd: 0,
        sonnet_count: 0, haiku_count: 0,
        avg_tokens_in: 0, avg_tokens_out: 0, cache_hit_ratio: 0,
        tools_freq: [] as Array<{ tool: string; count: number }>,
        briefing_cache_count: 0, avg_cost_per_chat: 0,
        exact_count: 0, estimated_count: 0,
      };
    }
    const cost_total_usd = list.reduce((sum, c) => sum + calcCostUSD(c), 0);
    const cost_total = cost_total_usd * usdToBrl;
    const sonnet_count = list.filter((c) => getEffectiveModel(c) === "sonnet").length;
    const haiku_count = list.length - sonnet_count;
    const exact_count = list.filter((c) => c.cost_usd_estimated != null).length;
    const estimated_count = list.length - exact_count;
    const total_in = list.reduce((s, c) => s + (c.tokens_in ?? 0), 0);
    const total_cache_read = list.reduce((s, c) => s + (c.tokens_cache_read ?? 0), 0);
    const total_out = list.reduce((s, c) => s + (c.tokens_out ?? 0), 0);
    const total_input = total_in + total_cache_read;
    const cache_hit_ratio = total_input > 0 ? (total_cache_read / total_input) * 100 : 0;

    const toolMap: Record<string, number> = {};
    for (const c of list) {
      for (const t of c.tools_used ?? []) {
        toolMap[t] = (toolMap[t] ?? 0) + 1;
      }
    }
    const tools_freq = Object.entries(toolMap)
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const briefing_cache_count = list.filter((c) => c.question === "__briefing__").length;

    return {
      total_chats: list.length,
      cost_total, cost_total_usd,
      sonnet_count, haiku_count,
      avg_tokens_in: Math.round(total_in / list.length),
      avg_tokens_out: Math.round(total_out / list.length),
      cache_hit_ratio,
      tools_freq,
      briefing_cache_count,
      avg_cost_per_chat: cost_total / list.length,
      exact_count, estimated_count,
    };
  }, [chats, usdToBrl]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const accuracyPct = stats.total_chats > 0 ? (stats.exact_count / stats.total_chats) * 100 : 0;

  // Diferença vs painel oficial (se calibrado)
  const officialMtdUsd = settings?.anthropic_mtd_cost_usd ?? null;
  const diffUsd = officialMtdUsd != null ? stats.cost_total_usd - officialMtdUsd : null;
  const diffPct = officialMtdUsd != null && officialMtdUsd > 0
    ? (diffUsd! / officialMtdUsd) * 100
    : null;
  const accuracyVsOfficial = diffPct !== null ? Math.max(0, 100 - Math.abs(diffPct)) : null;

  return (
    <div className="space-y-4">
      {/* Widget de calibragem com painel Anthropic */}
      <PremiumCard className="p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: "#F0F4F8" }}>
              🔄 Calibragem com painel Anthropic
            </h2>
            <p className="text-[10px] mt-0.5" style={{ color: "#94A3B8" }}>
              Última sync: {timeSince(settings?.last_synced_at ?? null)}
              {settings?.last_synced_at && ` (${new Date(settings.last_synced_at).toLocaleString("pt-BR")})`}
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href="https://console.anthropic.com/settings/cost"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 hover:opacity-80"
              style={{ background: "rgba(167,139,250,.1)", color: "#C4B5FD", border: "1px solid rgba(167,139,250,.3)" }}
            >
              <ExternalLink className="w-3 h-3" /> Abrir painel oficial
            </a>
            {!editMode ? (
              <button
                onClick={handleStartEdit}
                className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
                style={{ background: "rgba(232,201,122,.1)", color: "#E8C97A", border: "1px solid rgba(232,201,122,.3)" }}
              >
                <RefreshCw className="w-3 h-3" /> Atualizar valores
              </button>
            ) : (
              <>
                <button
                  onClick={() => setEditMode(false)}
                  className="px-3 py-1.5 rounded-lg text-xs"
                  style={{ border: "1px solid #1A2535", color: "#94A3B8" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveSettings}
                  disabled={updateSettings.isPending}
                  className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#C9A84C,#E8C97A)", color: "#0B1220" }}
                >
                  <Save className="w-3 h-3" /> Salvar
                </button>
              </>
            )}
          </div>
        </div>

        {editMode ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <label style={{ color: "#94A3B8" }}>Câmbio USD/BRL</label>
              <Input
                type="number" step="0.01" placeholder="5.00"
                value={draft.usd_to_brl}
                onChange={(e) => setDraft((d) => ({ ...d, usd_to_brl: e.target.value }))}
                style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
              />
            </div>
            <div>
              <label style={{ color: "#94A3B8" }}>Saldo créditos (USD)</label>
              <Input
                type="number" step="0.01" placeholder="30.54"
                value={draft.anthropic_balance_usd}
                onChange={(e) => setDraft((d) => ({ ...d, anthropic_balance_usd: e.target.value }))}
                style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
              />
            </div>
            <div>
              <label style={{ color: "#94A3B8" }}>MTD chave WT7 (USD)</label>
              <Input
                type="number" step="0.01" placeholder="5.90"
                value={draft.anthropic_mtd_cost_usd}
                onChange={(e) => setDraft((d) => ({ ...d, anthropic_mtd_cost_usd: e.target.value }))}
                style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
              />
            </div>
            <div>
              <label style={{ color: "#94A3B8" }}>MTD total (USD)</label>
              <Input
                type="number" step="0.01" placeholder="10.61"
                value={draft.anthropic_mtd_cost_total_usd}
                onChange={(e) => setDraft((d) => ({ ...d, anthropic_mtd_cost_total_usd: e.target.value }))}
                style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-mono" style={{ color: "#64748B" }}>Câmbio</p>
              <p className="text-base font-mono font-bold mt-1" style={{ color: "#F0F4F8" }}>R$ {usdToBrl.toFixed(2)}</p>
              <p className="text-[10px]" style={{ color: "#4A5568" }}>USD → BRL</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-mono" style={{ color: "#64748B" }}>Saldo Anthropic</p>
              <p className="text-base font-mono font-bold mt-1" style={{ color: "#34D399" }}>
                {settings?.anthropic_balance_usd != null ? formatUSD(settings.anthropic_balance_usd) : "—"}
              </p>
              <p className="text-[10px]" style={{ color: "#4A5568" }}>
                {settings?.anthropic_balance_usd != null ? `≈ ${formatBRL(settings.anthropic_balance_usd * usdToBrl)}` : "atualize"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-mono" style={{ color: "#64748B" }}>MTD oficial (WT7)</p>
              <p className="text-base font-mono font-bold mt-1" style={{ color: "#60A5FA" }}>
                {officialMtdUsd != null ? formatUSD(officialMtdUsd) : "—"}
              </p>
              <p className="text-[10px]" style={{ color: "#4A5568" }}>
                chave {settings?.api_key_label ?? "NavaWT7"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-mono" style={{ color: "#64748B" }}>Diferença vs estimativa</p>
              {diffPct !== null ? (
                <>
                  <p className="text-base font-mono font-bold mt-1" style={{
                    color: Math.abs(diffPct) <= 5 ? "#34D399" : Math.abs(diffPct) <= 15 ? "#FBBF24" : "#F43F5E"
                  }}>
                    {diffPct > 0 ? "+" : ""}{diffPct.toFixed(1)}%
                  </p>
                  <p className="text-[10px]" style={{ color: "#4A5568" }}>
                    estim. {formatUSD(stats.cost_total_usd)} | precisão {accuracyVsOfficial?.toFixed(0)}%
                  </p>
                </>
              ) : (
                <>
                  <p className="text-base font-mono font-bold mt-1" style={{ color: "#64748B" }}>—</p>
                  <p className="text-[10px]" style={{ color: "#4A5568" }}>preencha MTD oficial</p>
                </>
              )}
            </div>
          </div>
        )}
        <p className="text-[10px] mt-3" style={{ color: "#4A5568" }}>
          💡 Abre o painel Anthropic, copia os valores (saldo + custo MTD da chave NavaWT7), cola aqui.
          Sistema mostra a diferença vs a estimativa interna. Faça 1× por semana ou quando quiser auditar.
        </p>
      </PremiumCard>

      {/* Banner de precisão interna */}
      {stats.total_chats > 0 && (
        <div
          className="rounded-lg p-3 border text-xs"
          style={{
            background: accuracyPct >= 80 ? "rgba(16,185,129,.05)" : "rgba(251,191,36,.05)",
            borderColor: accuracyPct >= 80 ? "rgba(16,185,129,.3)" : "rgba(251,191,36,.3)",
            color: accuracyPct >= 80 ? "#34D399" : "#FBBF24",
          }}
        >
          <strong>{accuracyPct.toFixed(0)}% custo exato</strong> ·{" "}
          <span style={{ color: "#94A3B8" }}>
            {stats.exact_count} chamadas com modelo+custo gravados em tempo real (v44+) ·{" "}
            {stats.estimated_count} estimadas via heurística (chamadas pré-v44).
            {accuracyPct < 80 && " Precisão sobe conforme novas chamadas acumulam."}
          </span>
        </div>
      )}

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <PremiumCard className="p-4">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider" style={{ color: "#64748B" }}>
            <Activity className="w-3 h-3" /> Chamadas (30d)
          </div>
          <p className="text-2xl font-bold font-mono mt-2" style={{ color: "#F0F4F8" }}>{stats.total_chats}</p>
          <p className="text-[10px] mt-1" style={{ color: "#94A3B8" }}>
            {stats.briefing_cache_count} briefings cacheados
          </p>
        </PremiumCard>

        <PremiumCard className="p-4">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider" style={{ color: "#64748B" }}>
            <TrendingUp className="w-3 h-3" /> Custo total 30d
          </div>
          <p className="text-2xl font-bold font-mono mt-2" style={{ color: "#60A5FA" }}>{formatBRL(stats.cost_total)}</p>
          <p className="text-[10px] mt-1" style={{ color: "#94A3B8" }}>
            US$ {stats.cost_total_usd.toFixed(4)} · câmbio {USD_TO_BRL.toFixed(2)}
          </p>
        </PremiumCard>

        <PremiumCard className="p-4">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider" style={{ color: "#64748B" }}>
            <Zap className="w-3 h-3" /> Sonnet vs Haiku
          </div>
          <p className="text-2xl font-bold font-mono mt-2" style={{ color: "#A78BFA" }}>
            {stats.sonnet_count}<span className="text-sm" style={{ color: "#64748B" }}> · {stats.haiku_count}</span>
          </p>
          <p className="text-[10px] mt-1" style={{ color: "#94A3B8" }}>
            {stats.total_chats > 0 ? ((stats.sonnet_count / stats.total_chats) * 100).toFixed(0) : 0}% análise estratégica
          </p>
        </PremiumCard>

        <PremiumCard className="p-4">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider" style={{ color: "#64748B" }}>
            <AlertTriangle className="w-3 h-3" /> Cache hit
          </div>
          <p className="text-2xl font-bold font-mono mt-2" style={{ color: stats.cache_hit_ratio >= 60 ? "#34D399" : "#FBBF24" }}>
            {stats.cache_hit_ratio.toFixed(0)}%
          </p>
          <p className="text-[10px] mt-1" style={{ color: "#94A3B8" }}>
            {stats.cache_hit_ratio >= 60 ? "✓ ótimo" : "abaixo do esperado"}
          </p>
        </PremiumCard>
      </div>

      {/* Tokens médios */}
      <PremiumCard className="p-5">
        <h2 className="text-sm font-bold mb-3" style={{ color: "#F0F4F8" }}>
          🧮 Tokens médios por chamada
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-mono" style={{ color: "#64748B" }}>Input</p>
            <p className="text-lg font-mono font-bold mt-1" style={{ color: "#60A5FA" }}>{stats.avg_tokens_in.toLocaleString("pt-BR")}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-mono" style={{ color: "#64748B" }}>Output</p>
            <p className="text-lg font-mono font-bold mt-1" style={{ color: "#34D399" }}>{stats.avg_tokens_out.toLocaleString("pt-BR")}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-mono" style={{ color: "#64748B" }}>Cache hit</p>
            <p className="text-lg font-mono font-bold mt-1" style={{ color: stats.cache_hit_ratio >= 60 ? "#34D399" : "#FBBF24" }}>
              {stats.cache_hit_ratio.toFixed(1)}%
            </p>
          </div>
        </div>
      </PremiumCard>

      {/* Tools mais usadas */}
      <PremiumCard className="p-5">
        <h2 className="text-sm font-bold mb-3" style={{ color: "#F0F4F8" }}>
          🔧 Tools mais usadas (top 10)
        </h2>
        {stats.tools_freq.length === 0 ? (
          <p className="text-xs" style={{ color: "#64748B" }}>Sem dados de tools nos últimos 30 dias.</p>
        ) : (
          <div className="space-y-2">
            {stats.tools_freq.map(({ tool, count }) => {
              const pct = stats.total_chats > 0 ? (count / stats.total_chats) * 100 : 0;
              const isCalc = tool === "calc";
              return (
                <div key={tool} className="flex items-center gap-3 text-xs">
                  <span className="font-mono w-48 truncate" style={{ color: isCalc ? "#E8C97A" : "#94A3B8" }}>
                    {isCalc ? "🧮 " : ""}{tool}
                  </span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#0B1220" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        background: isCalc ? "linear-gradient(90deg, #C9A84C, #E8C97A)" : "linear-gradient(90deg, #3B82F6, #60A5FA)",
                      }}
                    />
                  </div>
                  <span className="font-mono w-16 text-right" style={{ color: "#94A3B8" }}>{count}× ({pct.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        )}
      </PremiumCard>

      {/* Estimativa anualizada */}
      <PremiumCard className="p-5">
        <h2 className="text-sm font-bold mb-3" style={{ color: "#F0F4F8" }}>
          💰 Projeção anualizada
        </h2>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p style={{ color: "#94A3B8" }}>Custo médio mensal (base 30d)</p>
            <p className="text-2xl font-bold font-mono mt-1" style={{ color: "#60A5FA" }}>{formatBRL(stats.cost_total)}</p>
          </div>
          <div>
            <p style={{ color: "#94A3B8" }}>Anualizado projetado</p>
            <p className="text-2xl font-bold font-mono mt-1" style={{ color: "#60A5FA" }}>{formatBRL(stats.cost_total * 12)}</p>
          </div>
        </div>
      </PremiumCard>

      {/* Status arquitetura */}
      <PremiumCard className="p-5">
        <h2 className="text-sm font-bold mb-3" style={{ color: "#F0F4F8" }}>
          ⚙️ Status arquitetura Jarvis
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          {[
            "Modelo híbrido Sonnet/Haiku",
            "Tool calc() obrigatório",
            "10 regras anti-erro (#0.1 a #0.10)",
            "Self-check pós-resposta",
            "Whitelist 10 pessoas",
            "Biblioteca v2: 6 sources + 86 princípios",
            "Hierarquia 5 níveis no prompt",
            "Cost tracking real-time (v44+)",
          ].map((label) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span style={{ color: "#F0F4F8" }}>{label}</span>
            </div>
          ))}
        </div>
      </PremiumCard>
    </div>
  );
}
