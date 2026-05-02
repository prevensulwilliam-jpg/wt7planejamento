/**
 * DailyStream — Stream do Dia (Bloco 4 do /hoje v4).
 *
 * Mostra cronologicamente:
 *  - Vencimentos auto (debt, recurring, wedding, comissões esperadas)
 *  - Tasks manuais
 *  - Tasks Naval-promovidas
 *  - Recurrence (treino diário, audit semanal)
 *
 * Features:
 *  - Filtros (Tudo / Entradas / Saídas / Tasks / Naval)
 *  - Checkboxes pra marcar done
 *  - Botão "+ task" com NLP via parse_task_nlp tool
 *  - Item "now" destacado em dourado
 *  - Adiar / cancelar via hover
 */
import { useState } from "react";
import { useDailyStream, useUpdateTaskStatus, useCreateTask, type StreamItem } from "@/hooks/useDailyStream";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Trash2, ArrowRight, Sparkles, Plus } from "lucide-react";

type Props = { date?: string };
type Filter = "all" | "in" | "out" | "task" | "naval";

const PERIOD_LABELS = {
  morning: "🌅 Manhã",
  afternoon: "☀️ Tarde",
  night: "🌙 Noite",
};

const BADGE_CSS: Record<string, { bg: string; color: string; label: string }> = {
  auto: { bg: "rgba(59,130,246,.15)", color: "#60A5FA", label: "auto" },
  manual: { bg: "rgba(167,139,250,.15)", color: "#C4B5FD", label: "manual" },
  naval: { bg: "linear-gradient(135deg,rgba(167,139,250,.3),rgba(201,168,76,.2))", color: "#C4B5FD", label: "🤖 Naval" },
  recur: { bg: "rgba(16,185,129,.15)", color: "#34D399", label: "recorr." },
};

function StreamItemRow({ item, onDone, onPostpone }: {
  item: StreamItem;
  onDone: () => void;
  onPostpone: () => void;
}) {
  const isDone = item.status === "done";
  const isExpected = item.status === "expected";
  const isTask = item.kind === "task";
  const isNavalPromoted = item.badge === "naval";

  const amountColor = item.kind === "in" ? "#34D399" : item.kind === "out" ? "#F43F5E" : "#C9A84C";
  const badgeStyle = BADGE_CSS[item.badge];

  return (
    <div
      className={`grid items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs transition-all ${item.is_now ? "ring-1" : ""} ${isDone ? "opacity-55" : ""}`}
      style={{
        gridTemplateColumns: isTask ? "auto 50px 1fr auto auto" : "50px 1fr auto auto",
        background: item.is_now ? "rgba(201,168,76,.06)" : "#0B1220",
        borderColor: item.is_now ? "#C9A84C" : "#1C2333",
        border: "1px solid",
        boxShadow: item.is_now ? "0 0 0 1px rgba(201,168,76,.2)" : "none",
        borderLeftWidth: isNavalPromoted ? 3 : 1,
        borderLeftColor: isNavalPromoted ? "#A78BFA" : (item.is_now ? "#C9A84C" : "#1C2333"),
      }}
    >
      {/* Checkbox (só pra tasks ou items que precisam confirmação) */}
      {isTask && (
        <button
          onClick={onDone}
          className="w-[18px] h-[18px] rounded border-[1.5px] flex items-center justify-center text-[11px] transition-colors"
          style={{
            background: isDone ? "#10B981" : "transparent",
            borderColor: isDone ? "#10B981" : "#4A5568",
            color: isDone ? "#000" : "transparent",
          }}
          title={isDone ? "Marcar pendente" : "Marcar feito"}
        >
          ✓
        </button>
      )}

      <div className="font-mono text-[10px] tracking-wider" style={{ color: "#4A5568" }}>
        {isExpected ? "~" : ""}{item.time}
      </div>

      <div className="min-w-0">
        <div className={`text-[12px] truncate ${isDone ? "line-through" : ""}`} style={{ color: "#F0F4F8" }}>
          <span
            className="inline-block px-1.5 py-[1px] rounded text-[8px] tracking-wider uppercase font-mono mr-1.5 align-middle"
            style={{
              background: badgeStyle.bg,
              color: badgeStyle.color,
              fontWeight: isNavalPromoted ? 700 : 500,
            }}
          >
            {badgeStyle.label}
          </span>
          {item.title}
        </div>
        {item.subtitle && (
          <div className="text-[10px]" style={{ color: "#4A5568" }}>{item.subtitle}</div>
        )}
      </div>

      <div className="font-mono font-bold text-[13px]" style={{ color: amountColor, opacity: isExpected ? 0.7 : 1 }}>
        {item.amount === null
          ? (isDone ? "✓" : "→")
          : `${item.amount > 0 ? "+" : "−"}${formatCurrency(Math.abs(item.amount)).replace(/^R\$\s*/, "")}`}
      </div>

      {isTask && !isDone && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onPostpone} title="Adiar pra amanhã" style={{ color: "#94A3B8" }}>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function DailyStream({ date }: Props) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const { data, isLoading } = useDailyStream(targetDate);
  const updateTask = useUpdateTaskStatus();
  const createTask = useCreateTask();
  const { toast } = useToast();

  const [filter, setFilter] = useState<Filter>("all");
  const [inputText, setInputText] = useState("");
  const [parsing, setParsing] = useState(false);

  if (isLoading) return <Skeleton className="h-96 rounded-xl" style={{ background: "#0D1318" }} />;
  if (!data) return null;

  const { items, summary } = data;

  const filteredItems = items.filter(i => {
    if (filter === "all") return true;
    if (filter === "task") return i.kind === "task";
    if (filter === "naval") return i.badge === "naval";
    return i.kind === filter;
  });

  const grouped = {
    morning: filteredItems.filter(i => i.period === "morning"),
    afternoon: filteredItems.filter(i => i.period === "afternoon"),
    night: filteredItems.filter(i => i.period === "night"),
  };

  const handleAdd = async () => {
    if (!inputText.trim()) return;
    setParsing(true);
    try {
      // Chama Naval pra parse_task_nlp via wisely-ai
      const { data: navalRes, error } = await supabase.functions.invoke("wisely-ai", {
        body: {
          messages: [
            { role: "user", content: `Use parse_task_nlp pra processar este texto e me retornar APENAS o JSON: "${inputText}"` },
          ],
          stream: false,
        },
      });
      if (error) throw error;

      // Naval pode retornar texto + JSON inline. Tentamos extrair.
      const responseText = navalRes?.text || "";
      let parsed: any = null;
      const jsonMatch = responseText.match(/\{[\s\S]*?"due_date"[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch (e) {
          // Fallback: cria task simples com texto literal
        }
      }

      // Fallback: input direto sem NLP (cria pra hoje)
      const taskInput = parsed?.parsed ?? parsed ?? {};
      await createTask.mutateAsync({
        title: taskInput.title || inputText,
        due_date: taskInput.due_date || targetDate,
        due_time: taskInput.due_time || null,
        vector: taskInput.vector || null,
        source: "manual",
        notes: null,
      });

      toast({ title: "Task criada", description: taskInput.title || inputText });
      setInputText("");
    } catch (e: any) {
      // Se Naval falhar, cria task simples mesmo
      try {
        await createTask.mutateAsync({
          title: inputText,
          due_date: targetDate,
          due_time: null,
          vector: null,
          source: "manual",
          notes: null,
        });
        toast({ title: "Task criada (sem NLP)", description: inputText });
        setInputText("");
      } catch (e2: any) {
        toast({ title: "Erro", description: e2.message, variant: "destructive" });
      }
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="rounded-xl p-4 border h-full" style={{ background: "#0F141B", borderColor: "#1A2535" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" style={{ color: "#C9A84C" }} />
          <span className="text-[11px] font-mono uppercase tracking-[1.5px]" style={{ color: "#64748B" }}>
            Stream do dia · {new Date(targetDate + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}
          </span>
        </div>
        <span className="text-[10px] font-mono" style={{ color: "#94A3B8" }}>
          {summary.total} itens · {summary.task_count} tasks
        </span>
      </div>

      {/* Summary bar */}
      <div
        className="flex justify-between items-center px-3 py-2 rounded-lg border mb-3 text-[12px]"
        style={{ background: "#0B1220", borderColor: "#1C2333" }}
      >
        <span style={{ color: "#94A3B8" }}>{summary.total} hoje</span>
        <span>
          <span className="font-mono font-bold" style={{ color: "#34D399" }}>+{formatCurrency(summary.total_in)}</span>
          {" · "}
          <span className="font-mono font-bold" style={{ color: "#F43F5E" }}>−{formatCurrency(Math.abs(summary.total_out))}</span>
        </span>
      </div>

      {/* Quick add com NLP */}
      <div
        className="flex gap-1.5 mb-3 p-2.5 rounded-lg border"
        style={{
          background: "linear-gradient(135deg,rgba(167,139,250,.05),transparent)",
          borderColor: "rgba(167,139,250,.25)",
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          placeholder="amanhã 14h ligar Premoldi · ou: toda segunda 8h audit"
          disabled={parsing}
          className="flex-1 bg-transparent border-none text-[13px] px-2 py-1 outline-none"
          style={{ color: "#F0F4F8" }}
        />
        <button
          onClick={handleAdd}
          disabled={parsing || !inputText.trim()}
          className="px-3 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1 disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg,#A78BFA,#8B5CF6)",
            color: "#fff",
          }}
        >
          {parsing ? "..." : (
            <>
              <Sparkles className="w-3 h-3" /> Add
            </>
          )}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {([
          ["all", "Tudo"],
          ["in", "Entradas"],
          ["out", "Saídas"],
          ["task", "Tasks"],
          ["naval", "🤖 Naval"],
        ] as Array<[Filter, string]>).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider transition-colors ${filter === key ? "" : "hover:bg-white/5"}`}
            style={{
              background: filter === key ? "#141A24" : "transparent",
              border: "1px solid",
              borderColor: filter === key ? "rgba(201,168,76,.4)" : "#1A2535",
              color: filter === key ? "#C9A84C" : "#64748B",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filteredItems.length === 0 ? (
        <p className="text-xs text-center py-8" style={{ color: "#64748B" }}>
          Nenhum item nesse filtro
        </p>
      ) : (
        <div className="space-y-3">
          {(["morning", "afternoon", "night"] as const).map(period => {
            const list = grouped[period];
            if (list.length === 0) return null;
            return (
              <div key={period}>
                <div className="text-[9px] font-mono uppercase tracking-[2px] mb-1.5 pl-2" style={{ color: "#4A5568" }}>
                  {PERIOD_LABELS[period]}
                </div>
                <div className="space-y-1.5">
                  {list.map(item => (
                    <StreamItemRow
                      key={item.id}
                      item={item}
                      onDone={() => {
                        if (item.source_type === "daily_task") {
                          updateTask.mutate({
                            taskId: item.source_id,
                            status: item.status === "done" ? "pending" : "done",
                          });
                        }
                      }}
                      onPostpone={() => {
                        if (item.source_type === "daily_task") {
                          const tomorrow = new Date(targetDate);
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          updateTask.mutate({
                            taskId: item.source_id,
                            status: "postponed",
                            newDate: tomorrow.toISOString().slice(0, 10),
                          });
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
