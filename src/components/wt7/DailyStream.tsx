/**
 * DailyStream — Stream do Dia / Semana / Mês (Bloco 4 do /hoje v4).
 *
 * Modos de visualização:
 *  - day: 1 dia, agrupado por período (manhã / tarde / noite)
 *  - week: 7 dias, agrupado por dia
 *  - month: ~30 dias, agrupado por dia
 *
 * Navegação: ◀ ▶ entre dias/semanas/meses + botão "Hoje".
 */
import { useState, useMemo } from "react";
import { useDailyStream, useUpdateTaskStatus, useCreateTask, useEditTask, useDeleteTask, type StreamItem } from "@/hooks/useDailyStream";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Clock, ArrowRight, Sparkles, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";

type Mode = "day" | "week" | "month";
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

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: string, n: number): string {
  const dt = new Date(d + "T00:00:00");
  dt.setDate(dt.getDate() + n);
  return isoDay(dt);
}

function startOfWeek(d: string): string {
  const dt = new Date(d + "T00:00:00");
  const dow = dt.getDay(); // 0=dom
  const diff = dow === 0 ? -6 : 1 - dow; // segunda como início
  dt.setDate(dt.getDate() + diff);
  return isoDay(dt);
}

function startOfMonth(d: string): string {
  return d.slice(0, 7) + "-01";
}

function endOfMonth(d: string): string {
  const [y, m] = d.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${d.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

function rangeFor(mode: Mode, anchor: string): { start: string; end: string } {
  if (mode === "day") return { start: anchor, end: anchor };
  if (mode === "week") return { start: startOfWeek(anchor), end: addDays(startOfWeek(anchor), 6) };
  return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
}

function shiftAnchor(mode: Mode, anchor: string, dir: -1 | 1): string {
  if (mode === "day") return addDays(anchor, dir);
  if (mode === "week") return addDays(anchor, dir * 7);
  // month
  const [y, m] = anchor.split("-").map(Number);
  const dt = new Date(y, m - 1 + dir, 1);
  return isoDay(dt);
}

function fmtBR(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

function fmtRange(mode: Mode, start: string, end: string): string {
  if (mode === "day") return fmtBR(start);
  if (mode === "month") {
    const dt = new Date(start + "T00:00:00");
    return dt.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }
  return `${fmtBR(start)} → ${fmtBR(end)}`;
}

function StreamItemRow({ item, onDone, onPostpone, onEdit, onDelete, showDate }: {
  item: StreamItem;
  onDone: () => void;
  onPostpone: () => void;
  onEdit: () => void;
  onDelete: () => void;
  showDate: boolean;
}) {
  const isDone = item.status === "done";
  const isExpected = item.status === "expected";
  const isTask = item.kind === "task";
  const isManualTask = isTask && item.source_type === "daily_task" && (item.badge === "manual" || item.badge === "naval");
  const isNavalPromoted = item.badge === "naval";
  // Semântica WT7: in (entrada/receita) = azul, out (saída/despesa) = vermelho, task = dourado neutro
  const amountColor = item.kind === "in" ? "#60A5FA" : item.kind === "out" ? "#F43F5E" : "#C9A84C";
  const badgeStyle = BADGE_CSS[item.badge];

  return (
    <div
      className={`grid items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs transition-all ${item.is_now ? "ring-1" : ""} ${isDone ? "opacity-55" : ""}`}
      style={{
        gridTemplateColumns: isTask ? "auto 50px 1fr auto auto" : "50px 1fr auto auto",
        background: item.is_now ? "rgba(201,168,76,.06)" : "#0B1220",
        border: "1px solid",
        borderColor: item.is_now ? "#C9A84C" : "#1C2333",
        boxShadow: item.is_now ? "0 0 0 1px rgba(201,168,76,.2)" : "none",
        borderLeftWidth: isNavalPromoted ? 3 : 1,
        borderLeftColor: isNavalPromoted ? "#A78BFA" : (item.is_now ? "#C9A84C" : "#1C2333"),
      }}
    >
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

      {isTask ? (
        <div className="flex gap-1.5 items-center">
          {isManualTask && (
            <>
              <button onClick={onEdit} title="Editar" className="hover:opacity-100 opacity-60" style={{ color: "#94A3B8" }}>
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={onDelete} title="Excluir" className="hover:opacity-100 opacity-60" style={{ color: "#F43F5E" }}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {!isDone && (
            <button onClick={onPostpone} title="Adiar pra amanhã" className="hover:opacity-100 opacity-60" style={{ color: "#94A3B8" }}>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : <div />}
    </div>
  );
}

export function DailyStream({ date }: { date?: string }) {
  const today = isoDay(new Date());
  const [anchor, setAnchor] = useState<string>(date || today);
  const [mode, setMode] = useState<Mode>("day");
  const [filter, setFilter] = useState<Filter>("all");
  const [inputText, setInputText] = useState("");
  const [parsing, setParsing] = useState(false);
  const { toast } = useToast();

  const { start, end } = useMemo(() => rangeFor(mode, anchor), [mode, anchor]);
  const { data, isLoading } = useDailyStream(start, end);
  const updateTask = useUpdateTaskStatus();
  const createTask = useCreateTask();
  const editTask = useEditTask();
  const deleteTask = useDeleteTask();

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<{
    id: string;
    title: string;
    due_date: string;
    due_time: string;
    vector: string;
    notes: string;
  } | null>(null);

  const openEdit = async (item: StreamItem) => {
    // Busca dados completos da task (vector + notes não estão em StreamItem)
    const { data: t } = await (supabase as any)
      .from("daily_tasks")
      .select("id, title, due_date, due_time, vector, notes")
      .eq("id", item.source_id)
      .maybeSingle();
    if (!t) {
      toast({ title: "Task não encontrada", variant: "destructive" });
      return;
    }
    setEditForm({
      id: t.id,
      title: t.title ?? "",
      due_date: t.due_date ?? "",
      due_time: t.due_time?.slice(0, 5) ?? "",
      vector: t.vector ?? "",
      notes: t.notes ?? "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm) return;
    if (!editForm.title.trim()) {
      toast({ title: "Título obrigatório", variant: "destructive" });
      return;
    }
    try {
      await editTask.mutateAsync({
        taskId: editForm.id,
        updates: {
          title: editForm.title.trim(),
          due_date: editForm.due_date,
          due_time: editForm.due_time || null,
          vector: editForm.vector.trim() || null,
          notes: editForm.notes.trim() || null,
        },
      });
      toast({ title: "Task atualizada" });
      setEditOpen(false);
      setEditForm(null);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (item: StreamItem) => {
    if (!confirm(`Excluir "${item.title}"?`)) return;
    try {
      await deleteTask.mutateAsync(item.source_id);
      toast({ title: "Task excluída" });
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
  };

  const filteredItems = useMemo(() => {
    if (!data) return [];
    return data.items.filter(i => {
      if (filter === "all") return true;
      if (filter === "task") return i.kind === "task";
      if (filter === "naval") return i.badge === "naval";
      return i.kind === filter;
    });
  }, [data, filter]);

  // Group by period (1 dia) ou por dia (semana/mês)
  const groupedByPeriod = useMemo(() => ({
    morning: filteredItems.filter(i => i.period === "morning"),
    afternoon: filteredItems.filter(i => i.period === "afternoon"),
    night: filteredItems.filter(i => i.period === "night"),
  }), [filteredItems]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, StreamItem[]>();
    for (const it of filteredItems) {
      if (!map.has(it.date)) map.set(it.date, []);
      map.get(it.date)!.push(it);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredItems]);

  const handleAdd = async () => {
    if (!inputText.trim()) return;
    setParsing(true);
    try {
      const { data: navalRes, error } = await supabase.functions.invoke("wisely-ai", {
        body: {
          messages: [
            { role: "user", content: `Use parse_task_nlp pra processar este texto e me retornar APENAS o JSON: "${inputText}"` },
          ],
          stream: false,
        },
      });
      if (error) throw error;

      const responseText = navalRes?.text || "";
      let parsed: any = null;
      const jsonMatch = responseText.match(/\{[\s\S]*?"due_date"[\s\S]*?\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch { /* ignore */ }
      }

      const taskInput = parsed?.parsed ?? parsed ?? {};
      const finalDate = taskInput.due_date || anchor;
      const finalTime = taskInput.due_time || null;
      const finalTitle = taskInput.title || inputText;
      await createTask.mutateAsync({
        title: finalTitle,
        due_date: finalDate,
        due_time: finalTime,
        vector: taskInput.vector || null,
        source: "manual",
        notes: null,
      });

      const dateLabel = finalDate === today ? "hoje" : fmtBR(finalDate);
      toast({
        title: `Task criada → ${dateLabel}${finalTime ? ` ${finalTime}` : ""}`,
        description: finalTitle,
      });
      setInputText("");
    } catch (e: any) {
      try {
        await createTask.mutateAsync({
          title: inputText,
          due_date: anchor,
          due_time: null,
          vector: null,
          source: "manual",
          notes: null,
        });
        toast({ title: `Task criada (sem NLP) → ${anchor === today ? "hoje" : fmtBR(anchor)}`, description: inputText });
        setInputText("");
      } catch (e2: any) {
        toast({ title: "Erro", description: e2.message, variant: "destructive" });
      }
    } finally {
      setParsing(false);
    }
  };

  if (isLoading) return <Skeleton className="h-96 rounded-xl" style={{ background: "#0D1318" }} />;
  if (!data) return null;

  const { summary } = data;
  const rangeLabel = fmtRange(mode, start, end);
  const isHere = mode === "day" ? anchor === today : (today >= start && today <= end);

  return (
    <div className="rounded-xl p-4 border flex flex-col h-full min-h-0" style={{ background: "#0F141B", borderColor: "#1A2535" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" style={{ color: "#C9A84C" }} />
          <span className="text-[11px] font-mono uppercase tracking-[1.5px]" style={{ color: "#64748B" }}>
            Stream · {rangeLabel}
          </span>
        </div>
        <span className="text-[10px] font-mono" style={{ color: "#94A3B8" }}>
          {summary.total} itens · {summary.task_count} tasks
        </span>
      </div>

      {/* Nav temporal + modos */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAnchor(shiftAnchor(mode, anchor, -1))}
            className="p-1.5 rounded-md hover:bg-white/5"
            title={`${mode === "day" ? "Dia" : mode === "week" ? "Semana" : "Mês"} anterior`}
            style={{ border: "1px solid #1A2535", color: "#94A3B8" }}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setAnchor(today)}
            disabled={isHere}
            className="px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider disabled:opacity-40"
            style={{ background: "transparent", border: "1px solid #1A2535", color: isHere ? "#4A5568" : "#C9A84C" }}
          >
            Hoje
          </button>
          <button
            onClick={() => setAnchor(shiftAnchor(mode, anchor, 1))}
            className="p-1.5 rounded-md hover:bg-white/5"
            title={`${mode === "day" ? "Dia" : mode === "week" ? "Semana" : "Mês"} seguinte`}
            style={{ border: "1px solid #1A2535", color: "#94A3B8" }}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex gap-1">
          {(["day", "week", "month"] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="px-2.5 py-1 rounded-md text-[10px] font-mono uppercase tracking-wider"
              style={{
                background: mode === m ? "#141A24" : "transparent",
                border: "1px solid",
                borderColor: mode === m ? "rgba(201,168,76,.4)" : "#1A2535",
                color: mode === m ? "#C9A84C" : "#64748B",
              }}
            >
              {m === "day" ? "Dia" : m === "week" ? "Semana" : "Mês"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary bar */}
      <div
        className="flex justify-between items-center px-3 py-2 rounded-lg border mb-3 text-[12px]"
        style={{ background: "#0B1220", borderColor: "#1C2333" }}
      >
        <span style={{ color: "#94A3B8" }}>
          {summary.total} {mode === "day" ? "hoje" : "no período"}
        </span>
        <span>
          <span className="font-mono font-bold" style={{ color: "#60A5FA" }}>+{formatCurrency(summary.total_in)}</span>
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
          style={{ background: "linear-gradient(135deg,#A78BFA,#8B5CF6)", color: "#fff" }}
        >
          {parsing ? "..." : (<><Sparkles className="w-3 h-3" /> Add</>)}
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

      {/* Lista — flex-1 + overflow controla altura no card pai */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">
      {filteredItems.length === 0 ? (
        <p className="text-xs text-center py-8" style={{ color: "#64748B" }}>
          Nenhum item nesse filtro
        </p>
      ) : mode === "day" ? (
        <div className="space-y-3">
          {(["morning", "afternoon", "night"] as const).map(period => {
            const list = groupedByPeriod[period];
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
                      showDate={false}
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
                          updateTask.mutate({
                            taskId: item.source_id,
                            status: "postponed",
                            newDate: addDays(item.date, 1),
                          });
                        }
                      }}
                      onEdit={() => openEdit(item)}
                      onDelete={() => handleDelete(item)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {groupedByDate.map(([day, list]) => {
            const isToday = day === today;
            return (
              <div key={day}>
                <div
                  className="text-[10px] font-mono uppercase tracking-[2px] mb-1.5 pl-2 flex items-center gap-2"
                  style={{ color: isToday ? "#C9A84C" : "#4A5568" }}
                >
                  <span>{fmtBR(day)}</span>
                  {isToday && <span className="text-[8px]">● HOJE</span>}
                  <span style={{ color: "#4A5568" }}>· {list.length}</span>
                </div>
                <div className="space-y-1.5">
                  {list.map(item => (
                    <StreamItemRow
                      key={item.id}
                      item={item}
                      showDate={true}
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
                          updateTask.mutate({
                            taskId: item.source_id,
                            status: "postponed",
                            newDate: addDays(item.date, 1),
                          });
                        }
                      }}
                      onEdit={() => openEdit(item)}
                      onDelete={() => handleDelete(item)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Modal de edição de task */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md" style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#F0F4F8" }}>Editar task</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="space-y-3">
              <div>
                <Label style={{ color: "#94A3B8" }}>Título</Label>
                <Input
                  value={editForm.title}
                  onChange={e => setEditForm(f => f && { ...f, title: e.target.value })}
                  style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label style={{ color: "#94A3B8" }}>Data</Label>
                  <Input
                    type="date"
                    value={editForm.due_date}
                    onChange={e => setEditForm(f => f && { ...f, due_date: e.target.value })}
                    style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
                  />
                </div>
                <div>
                  <Label style={{ color: "#94A3B8" }}>Hora (opcional)</Label>
                  <Input
                    type="time"
                    value={editForm.due_time}
                    onChange={e => setEditForm(f => f && { ...f, due_time: e.target.value })}
                    style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
                  />
                </div>
              </div>
              <div>
                <Label style={{ color: "#94A3B8" }}>Vetor (opcional)</Label>
                <Input
                  value={editForm.vector}
                  onChange={e => setEditForm(f => f && { ...f, vector: e.target.value })}
                  placeholder="ex: prevensul, rwt05, t7..."
                  style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
                />
              </div>
              <div>
                <Label style={{ color: "#94A3B8" }}>Notas (opcional)</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={e => setEditForm(f => f && { ...f, notes: e.target.value })}
                  rows={2}
                  style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <button
              onClick={() => { setEditOpen(false); setEditForm(null); }}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ border: "1px solid #1A2535", color: "#94A3B8" }}
            >
              Cancelar
            </button>
            <button
              onClick={saveEdit}
              disabled={editTask.isPending}
              className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#C9A84C,#E8C97A)", color: "#0B1220" }}
            >
              {editTask.isPending ? "Salvando..." : "Salvar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
