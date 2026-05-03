/**
 * NavalMetricasPage — dashboard de uso e custo do Naval.
 *
 * Métricas mostradas:
 *   - Custo estimado R$/mês (Sonnet + Haiku, com cache)
 *   - Total de chamadas (último mês)
 *   - % Sonnet vs Haiku
 *   - Tokens médios por chamada
 *   - Cache hit ratio
 *   - Tools mais usadas
 *   - Self-check rate (qtas correções automáticas)
 *
 * Fonte: tabela naval_chats (asked_at, tokens_in, tokens_out, tokens_cache_read,
 * tokens_cache_write, tools_used, version).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, TrendingUp, Zap, AlertTriangle, BarChart3, Bot } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Custo Anthropic por modelo (R$/M tokens, USD→BRL ~5.0 em mai/2026)
const COST_PER_M_TOKENS = {
  haiku: { input: 5.0, cache_read: 0.5, cache_write: 6.25, output: 25.0 },     // Haiku 4.5: $1/$0.1/$1.25/$5 USD
  sonnet: { input: 15.0, cache_read: 1.5, cache_write: 18.75, output: 75.0 },  // Sonnet 4.6: $3/$0.3/$3.75/$15 USD
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
  answer: string;
}

function inferModel(version: string | null): "sonnet" | "haiku" {
  // Heurística: versões v40+ têm híbrido — assumimos Sonnet pra conservar (pior caso de custo)
  // Na prática, o ideal seria salvar o model usado em uma coluna nova.
  if (!version) return "haiku";
  const v = version.toLowerCase();
  if (v.includes("v40") || v.includes("v41") || v.includes("v42") || v.includes("v43")) return "sonnet";
  return "haiku";
}

function calcCost(chat: NavalChat): number {
  const model = inferModel(chat.version);
  const rates = COST_PER_M_TOKENS[model];
  const inputCost = ((chat.tokens_in ?? 0) / 1_000_000) * rates.input;
  const cacheReadCost = ((chat.tokens_cache_read ?? 0) / 1_000_000) * rates.cache_read;
  const cacheWriteCost = ((chat.tokens_cache_write ?? 0) / 1_000_000) * rates.cache_write;
  const outputCost = ((chat.tokens_out ?? 0) / 1_000_000) * rates.output;
  return inputCost + cacheReadCost + cacheWriteCost + outputCost;
}

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

export default function NavalMetricasPage() {
  const navigate = useNavigate();

  // Busca chats dos últimos 30 dias
  const { data: chats, isLoading } = useQuery({
    queryKey: ["naval_metricas_30d"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await (supabase as any)
        .from("naval_chats")
        .select("id, asked_at, tokens_in, tokens_out, tokens_cache_read, tokens_cache_write, tools_used, version, question, answer")
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
        total_chats: 0,
        cost_total: 0,
        cost_projected_30d: 0,
        sonnet_count: 0,
        haiku_count: 0,
        avg_tokens_in: 0,
        avg_tokens_out: 0,
        cache_hit_ratio: 0,
        tools_freq: [] as Array<{ tool: string; count: number }>,
        briefing_cache_count: 0,
        avg_cost_per_chat: 0,
      };
    }
    const cost_total = list.reduce((sum, c) => sum + calcCost(c), 0);
    const sonnet_count = list.filter((c) => inferModel(c.version) === "sonnet").length;
    const haiku_count = list.length - sonnet_count;
    const total_in = list.reduce((s, c) => s + (c.tokens_in ?? 0), 0);
    const total_cache_read = list.reduce((s, c) => s + (c.tokens_cache_read ?? 0), 0);
    const total_out = list.reduce((s, c) => s + (c.tokens_out ?? 0), 0);
    const total_input = total_in + total_cache_read;
    const cache_hit_ratio = total_input > 0 ? (total_cache_read / total_input) * 100 : 0;

    // Frequência de tools
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
      cost_total,
      cost_projected_30d: cost_total, // já é últimos 30d
      sonnet_count,
      haiku_count,
      avg_tokens_in: list.length > 0 ? Math.round(total_in / list.length) : 0,
      avg_tokens_out: list.length > 0 ? Math.round(total_out / list.length) : 0,
      cache_hit_ratio,
      tools_freq,
      briefing_cache_count,
      avg_cost_per_chat: cost_total / list.length,
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

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ background: "#080C10" }}>
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b" style={{ borderColor: "#1A2535" }}>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2.5" style={{ color: "#F0F4F8" }}>
              <BarChart3 className="w-6 h-6" style={{ color: "#A78BFA" }} />
              Naval — Métricas
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
              Uso e custo dos últimos 30 dias · híbrido Sonnet 4.6 / Haiku 4.5
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/naval")}
              className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5"
              style={{ background: "rgba(167,139,250,.1)", color: "#C4B5FD", border: "1px solid rgba(167,139,250,.3)" }}
            >
              <Bot className="w-3 h-3" /> Voltar pro Naval
            </button>
            <button
              onClick={() => navigate("/naval/biblioteca")}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ background: "rgba(232,201,122,.1)", color: "#E8C97A", border: "1px solid rgba(232,201,122,.3)" }}
            >
              📚 Biblioteca
            </button>
          </div>
        </div>

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
              {formatBRL(stats.avg_cost_per_chat)} / chamada média
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
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "#F0F4F8" }}>
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
          <p className="text-[10px] mt-3 font-mono" style={{ color: "#4A5568" }}>
            cache hit alto = system prompt sendo reutilizado entre chamadas (custo cai ~10× por token)
          </p>
        </PremiumCard>

        {/* Tools mais usadas */}
        <PremiumCard className="p-5">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "#F0F4F8" }}>
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
          <p className="text-[10px] mt-3 font-mono" style={{ color: "#4A5568" }}>
            tool calc obrigatória pra aritmética desde v43 — quanto mais alto, mais Naval está respeitando a regra
          </p>
        </PremiumCard>

        {/* Estimativa anualizada */}
        <PremiumCard className="p-5">
          <h2 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ color: "#F0F4F8" }}>
            💰 Projeção de custo anualizada
          </h2>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p style={{ color: "#94A3B8" }}>Custo médio mensal (base últimos 30d)</p>
              <p className="text-2xl font-bold font-mono mt-1" style={{ color: "#60A5FA" }}>{formatBRL(stats.cost_total)}</p>
            </div>
            <div>
              <p style={{ color: "#94A3B8" }}>Custo anualizado projetado</p>
              <p className="text-2xl font-bold font-mono mt-1" style={{ color: "#60A5FA" }}>{formatBRL(stats.cost_total * 12)}</p>
            </div>
          </div>
          <p className="text-[10px] mt-3 font-mono" style={{ color: "#4A5568" }}>
            Custo estimado considerando: Haiku 4.5 (factual) e Sonnet 4.6 (estratégico) com prompt caching ativo. Self-check (~+30-50% tokens em análises) está incluído quando triggado.
          </p>
        </PremiumCard>

        {/* Status arquitetura Naval */}
        <PremiumCard className="p-5">
          <h2 className="text-sm font-bold mb-3" style={{ color: "#F0F4F8" }}>
            ⚙️ Status da arquitetura Jarvis (snapshot)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {[
              ["Modelo híbrido Sonnet/Haiku", true],
              ["Tool calc() obrigatório", true],
              ["10 regras anti-erro (#0.1 a #0.10)", true],
              ["Self-check pós-resposta", true],
              ["Whitelist 10 pessoas", true],
              ["Biblioteca v2: 6 sources + 86 princípios", true],
              ["Hierarquia 5 níveis no prompt", true],
              ["Embeddings via Gemini text-embedding-004", true],
            ].map(([label, active]) => (
              <div key={label as string} className="flex items-center gap-2">
                <span className={active ? "text-green-400" : "text-zinc-500"}>{active ? "✓" : "○"}</span>
                <span style={{ color: active ? "#F0F4F8" : "#64748B" }}>{label as string}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] mt-3 font-mono" style={{ color: "#4A5568" }}>
            Versão atual: v43-biblioteca-v2-com-metadados
          </p>
        </PremiumCard>
      </div>
    </div>
  );
}
