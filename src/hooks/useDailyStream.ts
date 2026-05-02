/**
 * useDailyStream — agrega TODAS as fontes do Stream.
 *
 * Aceita 1 dia (default) ou range (start..end) pra visões semana/mês.
 *
 * Fontes:
 *   1. AUTO: vencimentos (debt_installments, recurring_bills, wedding,
 *      other_commission_installments)
 *   2. MANUAL/NAVAL: daily_tasks
 *   3. RECEBIMENTOS: bank_transactions já confirmados
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StreamItemKind = "in" | "out" | "task" | "expected";
export type StreamItemBadge = "auto" | "manual" | "naval" | "recur";

export interface StreamItem {
  id: string;
  kind: StreamItemKind;
  badge: StreamItemBadge;
  date: string;             // YYYY-MM-DD
  time: string;             // HH:MM
  period: "morning" | "afternoon" | "night";
  title: string;
  subtitle: string;
  amount: number | null;
  status: "pending" | "done" | "expected" | "confirmed" | "cancelled";
  source_type: string;
  source_id: string;
  is_now?: boolean;
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

function enumerateDays(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const cur = new Date(s);
  while (cur <= e) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function useDailyStream(startDate?: string, endDate?: string) {
  const start = startDate || new Date().toISOString().slice(0, 10);
  const end = endDate || start;

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
    queryKey: ["daily_stream", start, end],
    queryFn: async () => {
      const items: StreamItem[] = [];
      const days = enumerateDays(start, end);

      // ─── 1. DAILY TASKS no range ──────────────────────────────────────
      const { data: tasks } = await (supabase as any)
        .from("daily_tasks")
        .select("id, title, due_date, due_time, status, vector, source, related_alert_id, notes")
        .gte("due_date", start)
        .lte("due_date", end)
        .neq("status", "cancelled")
        .order("due_date", { ascending: true })
        .order("due_time", { ascending: true, nullsFirst: false });

      const badgeMap: Record<string, StreamItemBadge> = {
        manual: "manual",
        naval_promoted: "naval",
        recurrence: "recur",
        crm_agendor: "manual",
      };

      for (const t of tasks ?? []) {
        const time = t.due_time?.slice(0, 5) || "12:00";
        items.push({
          id: `task_${t.id}`,
          kind: "task",
          badge: badgeMap[t.source] ?? "manual",
          date: t.due_date,
          time,
          period: timeToPeriod(time),
          title: t.title,
          subtitle: t.vector ? `${t.vector}${t.notes ? ` · ${t.notes}` : ""}` : t.notes ?? "",
          amount: null,
          status: t.status === "done" ? "done" : "pending",
          source_type: "daily_task",
          source_id: t.id,
        });
      }

      // ─── 2. DEBT INSTALLMENTS no range ────────────────────────────────
      const { data: debtInsts } = await (supabase as any)
        .from("debt_installments")
        .select("id, amount, due_date, paid_at, sequence_number, debt:debts(name, creditor)")
        .gte("due_date", start)
        .lte("due_date", end)
        .is("paid_at", null);
      for (const d of debtInsts ?? []) {
        items.push({
          id: `debt_${d.id}`,
          kind: "out",
          badge: "auto",
          date: d.due_date,
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

      // ─── 3. WEDDING INSTALLMENTS no range ─────────────────────────────
      const { data: weddInsts } = await (supabase as any)
        .from("wedding_installments")
        .select("id, amount, due_date, paid_at, supplier, description")
        .gte("due_date", start)
        .lte("due_date", end)
        .is("paid_at", null);
      for (const w of weddInsts ?? []) {
        items.push({
          id: `wedd_${w.id}`,
          kind: "out",
          badge: "auto",
          date: w.due_date,
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

      // ─── 4. OTHER COMMISSION INSTALLMENTS no range ────────────────────
      const { data: ociToday } = await (supabase as any)
        .from("other_commission_installments")
        .select("id, amount, due_date, paid_at, installment_number, commission:other_commissions(description)")
        .gte("due_date", start)
        .lte("due_date", end)
        .is("paid_at", null);
      for (const o of ociToday ?? []) {
        items.push({
          id: `oci_${o.id}`,
          kind: "in",
          badge: "auto",
          date: o.due_date,
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

      // ─── 5. RECURRING BILLS — gerar 1 item por dia que bate com due_day ─
      const { data: recurrings } = await (supabase as any)
        .from("recurring_bills")
        .select("id, name, amount, due_day, category, alias")
        .eq("active", true);
      for (const day of days) {
        const dayNum = parseInt(day.slice(8, 10));
        for (const r of recurrings ?? []) {
          if (r.due_day !== dayNum) continue;
          items.push({
            id: `recur_${r.id}_${day}`,
            kind: "out",
            badge: "auto",
            date: day,
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
      }

      // ─── 6. BANK TRANSACTIONS já confirmadas no range ─────────────────
      const { data: bankTxs } = await (supabase as any)
        .from("bank_transactions")
        .select("id, amount, type, description, date")
        .gte("date", start)
        .lte("date", end);
      for (const tx of bankTxs ?? []) {
        const amt = Number(tx.amount ?? 0);
        const isCredit = tx.type === "credit";
        items.push({
          id: `tx_${tx.id}`,
          kind: isCredit ? "in" : "out",
          badge: "auto",
          date: tx.date,
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

      // Marca item "now" — primeiro pendente cujo time ≥ now (só se range incluir hoje)
      const today = new Date().toISOString().slice(0, 10);
      if (today >= start && today <= end) {
        const now = nowTime();
        const idx = items.findIndex(it => it.date === today && it.status === "pending" && it.time >= now);
        if (idx >= 0) items[idx].is_now = true;
      }

      // Ordenação cronológica (data, depois hora)
      items.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

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
    staleTime: 60_000,
  });
}

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

export function useEditTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      updates,
    }: {
      taskId: string;
      updates: Partial<{
        title: string;
        due_date: string;
        due_time: string | null;
        vector: string | null;
        notes: string | null;
      }>;
    }) => {
      const { error } = await (supabase as any)
        .from("daily_tasks")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily_stream"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await (supabase as any)
        .from("daily_tasks")
        .delete()
        .eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily_stream"] }),
  });
}
