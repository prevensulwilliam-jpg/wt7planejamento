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
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, TrendingUp, Zap, AlertTriangle } from "lucide-react";

// Câmbio USD → BRL (atualizar quando relevante; v44+ grava custo em USD direto)
const USD_TO_BRL = 5.0;

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

export function NavalMetricasContent() {
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
    const cost_total = cost_total_usd * USD_TO_BRL;
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
  }, [chats]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const accuracyPct = stats.total_chats > 0 ? (stats.exact_count / stats.total_chats) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Banner de precisão */}
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
