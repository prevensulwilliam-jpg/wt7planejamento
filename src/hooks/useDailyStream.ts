/**
 * useDailyStream — agrega TODAS as fontes do Stream do Dia.
 *
 * Fontes:
 *   1. AUTO: vencimentos do dia (debt_installments, recurring_bills, wedding,
 *      other_commission_installments, kitnet_entries esperados)
 *   2. MANUAL/NAVAL: daily_tasks com due_date=today
 *   3. RECEBIMENTOS: bank_transactions já confirmados do dia
 *
 * Retorna lista cronológica + summary (entradas/saídas/tasks).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StreamItemKind = "in" | "out" | "task" | "expected";
export type StreamItemBadge = "auto" | "manual" | "naval" | "recur";

export interface StreamItem {
  id: string;
  kind: StreamItemKind;
  badge: StreamItemBadge;
  time: string;             // HH:MM
  period: "morning" | "afternoon" | "night";
  title: string;
  subtitle: string;
  amount: number | null;    // null pra task
  status: "pending" | "done" | "expected" | "confirmed" | "cancelled";
  source_type: string;      // 'debt_installment', 'recurring_bill', 'daily_task', etc
  source_id: string;
  is_now?: boolean;         // marker dourado pra item "agora"
}

function timeToPeriod(time: string): "morning" | "afternoon" | "night" {
  const h = parseInt(time.slice(0, 2));
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "night";
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function useDailyStream(date?: string) {
  const targetDate = date || new Date().toISOString().slice(0, 10);

  return useQuery<{
    items: StreamItem[];
    summary: {
      total: number;
      in_count: number;
      out_count: number;
      task_count: number;
      total_in: number;
      total_out: number;
    };
  }>({
    queryKey: ["daily_stream", targetDate],
    queryFn: async () => {
      const items: StreamItem[] = [];
      const monthStart = targetDate.slice(0, 7) + "-01";
      const [yy, mm] = targetDate.split("-").slice(0, 2).map(Number);
      const dayNum = parseInt(targetDate.slice(8, 10));

      // ─── 1. DAILY TASKS (manual + naval_promoted + recurrence) ─────────
      const { data: tasks } = await (supabase as any)
        .from("daily_tasks")
        .select("id, title, due_time, status, vector, source, related_alert_id, notes")
        .eq("due_date", targetDate)
        .neq("status", "cancelled")
        .order("due_time", { ascending: true, nullsFirst: false });

      for (const t of tasks ?? []) {
        const time = t.due_time?.slice(0, 5) || "12:00";
        const badgeMap: Record<string, StreamItemBadge> = {
          manual: "manual",
          naval_promoted: "naval",
          recurrence: "recur",
          crm_agendor: "manual",
        };
        items.push({
          id: `task_${t.id}`,
          kind: "task",
          badge: badgeMap[t.source] ?? "manual",
          time,
          period: timeToPeriod(time),
          title: t.title,
          subtitle: t.vector ? `${t.vector}${t.notes ? ` · ${t.notes}` : ""}` : t.notes ?? "",
          amount: null,
          status: t.status === "done" ? "done" : t.status === "in_progress" ? "pending" : "pending",
          source_type: "daily_task",
          source_id: t.id,
        });
      }

      // ─── 2. DEBT INSTALLMENTS vencendo hoje ──────────────────────────────
      const { data: debtInsts } = await (supabase as any)
        .from("debt_installments")
        .select("id, amount, due_date, paid_at, sequence_number, debt:debts(name, creditor)")
        .eq("due_date", targetDate)
        .is("paid_at", null);
      for (const d of debtInsts ?? []) {
        items.push({
          id: `debt_${d.id}`,
          kind: "out",
          badge: "auto",
          time: "12:00",
          period: "afternoon",
          title: d.debt?.name || "Parcela de dívida",
          subtitle: `${d.debt?.creditor ?? ""} · parcela ${d.sequence_number}`,
          amount: -Number(d.amount ?? 0),
          status: "pending",
          source_type: "debt_installment",
          source_id: d.id,
        });
      }

      // ─── 3. WEDDING INSTALLMENTS vencendo hoje ───────────────────────────
      const { data: weddInsts } = await (supabase as any)
        .from("wedding_installments")
        .select("id, amount, due_date, paid_at, supplier, description")
        .eq("due_date", targetDate)
        .is("paid_at", null);
      for (const w of weddInsts ?? []) {
        items.push({
          id: `wedd_${w.id}`,
          kind: "out",
          badge: "auto",
          time: "12:00",
          period: "afternoon",
          title: w.description || "Casamento",
          subtitle: `Villa Sonali · ${w.supplier}`,
          amount: -Number(w.amount ?? 0),
          status: "pending",
          source_type: "wedding_installment",
          source_id: w.id,
        });
      }

      // ─── 4. OTHER COMMISSION INSTALLMENTS esperados hoje ─────────────────
      const { data: ociToday } = await (supabase as any)
        .from("other_commission_installments")
        .select("id, amount, due_date, paid_at, installment_number, commission:other_commissions(description)")
        .eq("due_date", targetDate)
        .is("paid_at", null);
      for (const o of ociToday ?? []) {
        items.push({
          id: `oci_${o.id}`,
          kind: "in",
          badge: "auto",
          time: "12:00",
          period: "afternoon",
          title: o.commission?.description || "Comissão externa",
          subtitle: `parcela ${o.installment_number}`,
          amount: Number(o.amount ?? 0),
          status: "expected",
          source_type: "other_commission_installment",
          source_id: o.id,
        });
      }

      // ─── 5. RECURRING BILLS vencendo hoje (due_day match) ────────────────
      const { data: recurrings } = await (supabase as any)
        .from("recurring_bills")
        .select("id, name, amount, due_day, category, alias")
        .eq("active", true)
        .eq("due_day", dayNum);
      for (const r of recurrings ?? []) {
        items.push({
          id: `recur_${r.id}`,
          kind: "out",
          badge: "auto",
          time: r.due_day < 15 ? "12:00" : "18:00",
          period: r.due_day < 15 ? "afternoon" : "night",
          title: r.alias || r.name,
          subtitle: r.category ?? "recurring",
          amount: -Number(r.amount ?? 0),
          status: "pending",
          source_type: "recurring_bill",
          source_id: r.id,
        });
      }

      // ─── 6. BANK TRANSACTIONS já confirmadas hoje ────────────────────────
      const { data: bankTxs } = await (supabase as any)
        .from("bank_transactions")
        .select("id, amount, type, description, date")
        .eq("date", targetDate);
      for (const tx of bankTxs ?? []) {
        const amt = Number(tx.amount ?? 0);
        const isCredit = tx.type === "credit";
        items.push({
          id: `tx_${tx.id}`,
          kind: isCredit ? "in" : "out",
          badge: "auto",
          time: "08:30",
          period: "morning",
          title: tx.description?.slice(0, 60) || "Transação",
          subtitle: "extrato bancário",
          amount: isCredit ? amt : -amt,
          status: "confirmed",
          source_type: "bank_transaction",
          source_id: tx.id,
        });
      }

      // Marca item "now" — primeiro pendente cujo time ≥ now
      const isToday = targetDate === new Date().toISOString().slice(0, 10);
      if (isToday) {
        const now = nowTime();
        const idx = items.findIndex(it => it.status === "pending" && it.time >= now);
        if (idx >= 0) items[idx].is_now = true;
      }

      // Ordenação cronológica
      items.sort((a, b) => a.time.localeCompare(b.time));

      // Summary
      const summary = {
        total: items.length,
        in_count: items.filter(i => i.kind === "in").length,
        out_count: items.filter(i => i.kind === "out").length,
        task_count: items.filter(i => i.kind === "task").length,
        total_in: items.filter(i => i.amount && i.amount > 0).reduce((s, i) => s + (i.amount ?? 0), 0),
        total_out: items.filter(i => i.amount && i.amount < 0).reduce((s, i) => s + (i.amount ?? 0), 0),
      };

      return { items, summary };
    },
    staleTime: 60_000, // 1 min
  });
}

/**
 * useUpdateTaskStatus — marca task como done/pending/postponed.
 * Atualiza optimistic na cache do useDailyStream.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      status,
      newDate,
    }: {
      taskId: string;
      status: "pending" | "done" | "postponed" | "cancelled";
      newDate?: string;
    }) => {
      const updates: any = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (status === "done") updates.completed_at = new Date().toISOString();
      if (status === "postponed" && newDate) updates.due_date = newDate;
      const { error } = await (supabase as any)
        .from("daily_tasks")
        .update(updates)
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily_stream"] }),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: {
      title: string;
      due_date: string;
      due_time?: string | null;
      vector?: string | null;
      source?: string;
      notes?: string | null;
      recurrence_rule_id?: string | null;
    }) => {
      const { error } = await (supabase as any).from("daily_tasks").insert({
        title: task.title,
        due_date: task.due_date,
        due_time: task.due_time ?? null,
        vector: task.vector ?? null,
        source: task.source ?? "manual",
        notes: task.notes ?? null,
        recurrence_rule_id: task.recurrence_rule_id ?? null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily_stream"] }),
  });
}
