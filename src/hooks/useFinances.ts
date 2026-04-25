import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { sumMoney } from "@/lib/formatters";

// Predicado único de "despesa real de custeio". Usado em TODO hook que soma
// expenses.amount como gasto. Mantém regras:
//   - nature = 'expense' (não transferência, não investimento, não card_payment)
//   - is_card_payment = false (evita duplicar com card_transactions)
//   - counts_as_investment = false (aportes vão pra Sobra Reinvestida)
// Defaults assumem expense padrão quando os campos são null.
const isActualExpense = (e: any): boolean => {
  const nature = (e?.nature as string | null | undefined) ?? "expense";
  const isCardPayment = e?.is_card_payment === true;
  const isInvestment = e?.counts_as_investment === true;
  return nature === "expense" && !isCardPayment && !isInvestment;
};

// Predicado "receita real" usado no dashboard.
const isActualIncome = (r: any): boolean => r?.counts_as_income !== false;

// ─── RECEITAS ───
export function useRevenues(month?: string) {
  return useQuery({
    queryKey: ["revenues", month],
    queryFn: async () => {
      let q = supabase.from("revenues").select("*").order("received_at", { ascending: false });
      if (month) q = q.eq("reference_month", month);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: TablesInsert<"revenues">) => {
      const { error } = await supabase.from("revenues").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revenues"] });
      qc.invalidateQueries({ queryKey: ["sobra_reinvestida"] });
    },
  });
}

export function useDeleteRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("revenues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revenues"] });
      qc.invalidateQueries({ queryKey: ["sobra_reinvestida"] });
    },
  });
}

// ─── DESPESAS ───
export function useExpenses(month?: string) {
  return useQuery({
    queryKey: ["expenses", month],
    queryFn: async () => {
      let q = supabase.from("expenses").select("*").order("paid_at", { ascending: false });
      if (month) q = q.eq("reference_month", month);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: TablesInsert<"expenses">) => {
      const { error } = await supabase.from("expenses").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["sobra_reinvestida"] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["sobra_reinvestida"] });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      category?: string;
      type?: string;
      description?: string;
      amount?: number;
      counts_as_investment?: boolean;
      vector?: string | null;
      is_card_payment?: boolean;
      nature?: string;
    }) => {
      const { error } = await supabase.from("expenses").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["sobra_reinvestida"] });
    },
  });
}

export function useUpdateRevenue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      source?: string;
      type?: string;
      description?: string;
      amount?: number;
      counts_as_income?: boolean;
      nature?: string;
    }) => {
      const { error } = await supabase.from("revenues").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["revenues"] });
      qc.invalidateQueries({ queryKey: ["sobra_reinvestida"] });
    },
  });
}

// ─── ALUGUÉIS KITNETS (Modelo A — fonte única) ───
// Fonte da verdade = `kitnet_entries.total_liquid` dos fechamentos
// reconciled. Versão simplificada: só consulta kitnet_entries (1 query)
// pra evitar travamento da query secundária bank_transactions.in(...)
// que estava deixando o React Query em isLoading infinito.
//
// Validação banco × declarado fica em hook separado (useKitnetGap)
// chamado apenas quando precisar — não bloqueia o KPI principal.
export function useKitnetMonthRevenue(month?: string) {
  return useQuery({
    queryKey: ["kitnet_month_revenue", month],
    queryFn: async () => {
      let qe = supabase
        .from("kitnet_entries")
        .select("id, total_liquid, reference_month, reconciled");
      if (month) qe = qe.eq("reference_month", month);
      const { data: entries, error: ee } = await qe;
      if (ee) throw ee;

      const all = entries ?? [];
      const reconciled = all.filter((e: any) => e.reconciled === true);
      const total = sumMoney(reconciled.map((e: any) => e.total_liquid));

      return {
        total,
        count: reconciled.length,
        entries: reconciled,
        all,
        // Campos do hook antigo mantidos como 0 pra não quebrar consumidores
        totalBankLinked: 0,
        gap: 0,
        hasGap: false,
        bankTxCount: 0,
      };
    },
  });
}

// ─── KPIs DO DASHBOARD ───
// Receitas: filtra counts_as_income=true (exclui transfer/reimbursement/refund).
//           + soma kitnet_entries.total_liquid conciliadas do mês (Modelo A)
// Despesas: filtra nature='expense' + !is_card_payment + !counts_as_investment
// (exclui transferência entre contas, pagamento de fatura, aportes).
export function useDashboardKPIs(month: string) {
  const revenues = useRevenues(month);
  const expenses = useExpenses(month);
  const kitnetRev = useKitnetMonthRevenue(month);

  const actualRevenues = (revenues.data ?? []).filter(isActualIncome);
  const actualExpenses = (expenses.data ?? []).filter(isActualExpense);

  const revenuesTableTotal = sumMoney(actualRevenues.map((r: any) => r.amount));
  const kitnetTotal = kitnetRev.data?.total ?? 0;
  const totalRevenue = sumMoney([revenuesTableTotal, kitnetTotal]);
  const totalExpenses = sumMoney(actualExpenses.map((e: any) => e.amount));
  const netResult = totalRevenue - totalExpenses;

  const revenueBySource = actualRevenues.reduce((acc, r: any) => {
    const src = r.source ?? "outros";
    acc[src] = sumMoney([acc[src], r.amount]);
    return acc;
  }, {} as Record<string, number>);
  if (kitnetTotal > 0) {
    revenueBySource["aluguel_kitnets"] = sumMoney([revenueBySource["aluguel_kitnets"] ?? 0, kitnetTotal]);
  }

  const expenseByCategory = actualExpenses.reduce((acc, e: any) => {
    const cat = e.category ?? "outros";
    acc[cat] = sumMoney([acc[cat], e.amount]);
    return acc;
  }, {} as Record<string, number>);

  return {
    totalRevenue,
    revenuesTableTotal,
    kitnetTotal,
    kitnetCount: kitnetRev.data?.count ?? 0,
    totalExpenses,
    netResult,
    revenueBySource,
    expenseByCategory,
    isLoading: revenues.isLoading || expenses.isLoading || kitnetRev.isLoading,
  };
}

// ─── ÚLTIMOS 6 MESES para gráfico ───
export function useRevenueExpenseTrend() {
  return useQuery({
    queryKey: ["revenue_expense_trend"],
    queryFn: async () => {
      const months: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
      const [revRes, expRes, kitRes] = await Promise.all([
        supabase
          .from("revenues")
          .select("amount, reference_month, counts_as_income")
          .in("reference_month", months),
        supabase
          .from("expenses")
          .select("amount, reference_month, nature, is_card_payment, counts_as_investment")
          .in("reference_month", months),
        supabase
          .from("kitnet_entries")
          .select("total_liquid, reference_month, reconciled")
          .in("reference_month", months),
      ]);
      return months.map(m => {
        const [, mm] = m.split("-");
        const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        const monthRevenues = (revRes.data ?? [])
          .filter((r: any) => r.reference_month === m)
          .filter(isActualIncome);
        const monthExpenses = (expRes.data ?? [])
          .filter((e: any) => e.reference_month === m)
          .filter(isActualExpense);
        const monthKitnets = (kitRes.data ?? [])
          .filter((k: any) => k.reference_month === m && k.reconciled === true);
        const receitaRevenues = sumMoney(monthRevenues.map((r: any) => r.amount));
        const receitaKitnets = sumMoney(monthKitnets.map((k: any) => k.total_liquid));
        return {
          month: monthNames[parseInt(mm) - 1],
          monthKey: m,
          receita: sumMoney([receitaRevenues, receitaKitnets]),
          despesa: sumMoney(monthExpenses.map((e: any) => e.amount)),
        };
      });
    },
  });
}

// ─── METAS ───
export function useGoals() {
  return useQuery({
    queryKey: ["goals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("goals").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"goals"> & { id: string }) => {
      const { error } = await supabase.from("goals").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
}

// ─── PATRIMÔNIO ───
export function useAssets() {
  return useQuery({
    queryKey: ["assets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("assets").select("*").order("estimated_value", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ─── BANK ACCOUNTS ───
export function useBankAccounts() {
  return useQuery({
    queryKey: ["bank_accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*").order("bank_name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { bank_name: string; account_type?: string; balance?: number; last_updated?: string; notes?: string }) => {
      const { error } = await supabase.from("bank_accounts").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank_accounts"] }),
  });
}

export function useUpdateBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; balance?: number; last_updated?: string; bank_name?: string; account_type?: string; notes?: string }) => {
      const { error } = await supabase.from("bank_accounts").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank_accounts"] }),
  });
}

export function useDeleteBankAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bank_accounts"] }),
  });
}

// ─── PATRIMÔNIO LÍQUIDO ───
// Cálculo correto:
//   Ativos:
//     Σ assets.estimated_value  (valor líquido dos bens — Rampage já é líquida da dívida)
//   + Σ investments.current_amount  (caixa em investimentos)
//   + Σ properties.property_value × ownership_pct/100  (cota no imóvel/obra)
//   + Σ consortiums.total_paid × ownership_pct/100  (parcelas já pagas = patrimônio consorcial)
//   + Σ bank_accounts.balance  (saldo atual das contas correntes)
//
//   Passivos:
//   − Σ debts.remaining_amount  (saldos devedores ativos)
//
// IMPORTANTE: se assets.estimated_value JÁ é líquido da dívida correspondente
// (ex: Rampage = valor_carro − saldo_devedor), não cadastre essa dívida também
// em `debts` — senão fica double counting.
export function useNetWorth() {
  const assets = useAssets();

  const investments = useQuery({
    queryKey: ["investments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("investments").select("current_amount");
      if (error) throw error;
      return data;
    },
  });

  const bankAccounts = useQuery({
    queryKey: ["bank_accounts_networth"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("balance");
      if (error) throw error;
      return data;
    },
  });

  const properties = useQuery({
    queryKey: ["real_estate_properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("real_estate_properties")
        .select("property_value, ownership_pct");
      if (error) throw error;
      return data;
    },
  });

  const consortiums = useQuery({
    queryKey: ["consortiums_networth"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consortiums")
        .select("total_paid, ownership_pct, status")
        .in("status", ["active", "paid_off", "contemplated"]);
      if (error) throw error;
      return data;
    },
  });

  const debts = useQuery({
    queryKey: ["debts_active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("remaining_amount, status")
        .neq("status", "paid");
      if (error) throw error;
      return data;
    },
  });

  const assetsTotal = sumMoney((assets.data ?? []).map((a: any) => a.estimated_value));
  const investmentsTotal = sumMoney((investments.data ?? []).map((i: any) => i.current_amount));
  const propertiesTotal = sumMoney(
    (properties.data ?? []).map((p: any) => {
      const pct = p.ownership_pct == null ? 100 : Number(p.ownership_pct);
      return (Number(p.property_value) || 0) * (pct / 100);
    })
  );
  const consortiumsTotal = sumMoney(
    (consortiums.data ?? []).map((c: any) => {
      const pct = c.ownership_pct == null ? 100 : Number(c.ownership_pct);
      return (Number(c.total_paid) || 0) * (pct / 100);
    })
  );
  const bankBalanceTotal = sumMoney((bankAccounts.data ?? []).map((b: any) => b.balance));
  const debtsTotal = sumMoney((debts.data ?? []).map((d: any) => d.remaining_amount));

  const grossAssets = sumMoney([
    assetsTotal,
    investmentsTotal,
    propertiesTotal,
    consortiumsTotal,
    bankBalanceTotal,
  ]);
  const netWorth = grossAssets - debtsTotal;

  return {
    netWorth,
    grossAssets,
    assetsTotal,
    investmentsTotal,
    propertiesTotal,
    consortiumsTotal,
    bankBalanceTotal,
    debtsTotal,
    isLoading:
      assets.isLoading ||
      bankAccounts.isLoading ||
      investments.isLoading ||
      properties.isLoading ||
      consortiums.isLoading ||
      debts.isLoading,
  };
}

// ─── CSV EXPORT ───
export function exportCSV(data: Record<string, any>[], headers: string[], keys: string[], filename: string) {
  const rows = data.map(r => keys.map(k => r[k] ?? ""));
  const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
