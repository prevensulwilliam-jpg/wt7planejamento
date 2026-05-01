import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

// ─── CONSTRUCTIONS (nova tabela, vinculada a assets) ─────────────────────────

export function useConstructions() {
  return useQuery({
    queryKey: ["constructions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("constructions")
        .select("*, assets(id, name, type, cep, logradouro, numero, bairro, cidade, estado)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateConstruction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: any) => {
      const { error } = await (supabase as any).from("constructions").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["constructions"] }),
  });
}

export function useUpdateConstruction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await (supabase as any).from("constructions").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["constructions"] }),
  });
}

export function useDeleteConstruction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("constructions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["constructions"] }),
  });
}

// ─── CONSTRUCTION STAGES ─────────────────────────────────────────────────────

export function useConstructionStages(constructionId?: string) {
  return useQuery({
    queryKey: ["construction_stages", constructionId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("construction_stages")
        .select("*")
        .eq("construction_id", constructionId)
        .order("order_index", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!constructionId,
  });
}

export function useCreateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: any) => {
      const { error } = await (supabase as any).from("construction_stages").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["construction_stages"] }),
  });
}

export function useUpdateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await (supabase as any).from("construction_stages").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["construction_stages"] }),
  });
}

export function useDeleteStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("construction_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["construction_stages"] }),
  });
}

// ─── CONSTRUCTION EXPENSES (atualizado para usar construction_id) ─────────────

export function useConstructionExpenses(constructionId?: string, fetchAll?: boolean) {
  return useQuery({
    queryKey: ["construction_expenses", constructionId ?? "all"],
    queryFn: async () => {
      let q = (supabase as any)
        .from("construction_expenses")
        .select("*")
        .order("expense_date", { ascending: false });
      if (constructionId) q = q.eq("construction_id", constructionId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!constructionId || !!fetchAll,
  });
}

// ─── LEGACY: real_estate_properties (mantido para compatibilidade) ────────────

export function useProperties() {
  return useQuery({
    queryKey: ["real_estate_properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("real_estate_properties").select("*").order("code");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateConstructionExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: TablesInsert<"construction_expenses">) => {
      const { error } = await (supabase as any).from("construction_expenses").insert(entry);
      if (error) { console.error("construction_expenses insert error:", error); throw error; }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["construction_expenses"] }),
  });
}

export function useUpdateConstructionExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await (supabase as any).from("construction_expenses").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["construction_expenses"] }),
  });
}

export function useDeleteConstructionExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("construction_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["construction_expenses"] }),
  });
}

// ─── CONSTRUCTION PARTNER PAYMENTS (saldo entre sócios) ───────────────

export type PartnerPaymentDirection = "partner_to_william" | "william_to_partner";

export function useConstructionPartnerPayments(constructionId?: string, fetchAll?: boolean) {
  return useQuery({
    queryKey: ["construction_partner_payments", constructionId ?? "all"],
    queryFn: async () => {
      let q = (supabase as any)
        .from("construction_partner_payments")
        .select("*")
        .order("payment_date", { ascending: false });
      if (constructionId) q = q.eq("construction_id", constructionId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Array<{
        id: string;
        construction_id: string;
        partner_name: string;
        direction: PartnerPaymentDirection;
        payment_date: string;
        amount: number;
        payment_method: string | null;
        bank_tx_id: string | null;
        notes: string | null;
        created_at: string;
      }>;
    },
    enabled: !!constructionId || !!fetchAll,
  });
}

export function useCreateConstructionPartnerPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      construction_id: string;
      partner_name: string;
      direction: PartnerPaymentDirection;
      payment_date: string;
      amount: number;
      payment_method?: string | null;
      bank_tx_id?: string | null;
      notes?: string | null;
    }) => {
      const { error } = await (supabase as any).from("construction_partner_payments").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["construction_partner_payments"] }),
  });
}

export function useDeleteConstructionPartnerPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("construction_partner_payments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["construction_partner_payments"] }),
  });
}

export function useUpdateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"real_estate_properties"> & { id: string }) => {
      const { error } = await supabase.from("real_estate_properties").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["real_estate_properties"] }),
  });
}

export function useDeleteProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("real_estate_properties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["real_estate_properties"] }),
  });
}

// Investments — SOMENTE via RPC (SECURITY DEFINER) para contornar
// revogação periódica de GRANTs pelo Lovable
export function useInvestments() {
  return useQuery({
    queryKey: ["investments"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_investments" as any);
      if (error) throw new Error("get_investments RPC: " + error.message);
      return (data ?? []) as any[];
    },
  });
}

export function useCreateInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: any) => {
      const { error } = await supabase.rpc("upsert_investment" as any, { p_data: entry });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["investments"] }),
  });
}

// Consortiums
export function useConsortiums() {
  return useQuery({
    queryKey: ["consortiums"],
    queryFn: async () => {
      const { data, error } = await supabase.from("consortiums").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateConsortium() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: TablesInsert<"consortiums">) => {
      const { error } = await supabase.from("consortiums").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consortiums"] }),
  });
}

// Taxes
export function useTaxes() {
  return useQuery({
    queryKey: ["taxes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("taxes").select("*").order("due_date");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateTax() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: TablesInsert<"taxes">) => {
      const { error } = await supabase.from("taxes").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["taxes"] }),
  });
}

export function useUpdateTax() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"taxes"> & { id: string }) => {
      const { error } = await supabase.from("taxes").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["taxes"] }),
  });
}

// Debts
export function useDebts() {
  return useQuery({
    queryKey: ["debts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("debts").select("*").order("due_date");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: TablesInsert<"debts">) => {
      const { error } = await supabase.from("debts").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["debts"] }),
  });
}

export function useUpdateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"debts"> & { id: string }) => {
      const { error } = await supabase.from("debts").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["debts"] }),
  });
}

// Wedding installments
export function useWeddingInstallments() {
  return useQuery({
    queryKey: ["wedding_installments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wedding_installments").select("*").order("due_date");
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateWeddingInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"wedding_installments"> & { id: string }) => {
      const { error } = await supabase.from("wedding_installments").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wedding_installments"] }),
  });
}

// Create asset
export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: TablesInsert<"assets">) => {
      const { error } = await supabase.from("assets").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets"] }),
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TablesInsert<"assets">> & { id: string }) => {
      const { error } = await supabase.from("assets").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets"] }),
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets"] }),
  });
}

export function useUpdateInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase.rpc("upsert_investment" as any, { p_data: { id, ...updates } });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["investments"] }),
  });
}

export function useDeleteInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("delete_investment" as any, { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["investments"] }),
  });
}

export function useUpdateConsortium() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase.from("consortiums" as any).update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consortiums"] }),
  });
}

export function useDeleteConsortium() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("consortiums" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consortiums"] }),
  });
}

// Create goal
export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: TablesInsert<"goals">) => {
      const { error } = await supabase.from("goals").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals"] }),
  });
}

// Wedding Vendors
export function useWeddingVendors() {
  return useQuery({
    queryKey: ["wedding_vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wedding_vendors" as any)
        .select("*, wedding_vendor_payments(*)")
        .order("service");
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useCreateWeddingVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vendor: any) => {
      const { error } = await supabase.from("wedding_vendors" as any).insert(vendor);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wedding_vendors"] }),
  });
}

export function useUpdateWeddingVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase.from("wedding_vendors" as any).update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wedding_vendors"] }),
  });
}

export function useDeleteWeddingVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wedding_vendors" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wedding_vendors"] }),
  });
}

export function useCreateVendorPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payment: any) => {
      const { error } = await supabase.from("wedding_vendor_payments" as any).insert(payment);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wedding_vendors"] }),
  });
}

export function useUpdateVendorPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase.from("wedding_vendor_payments" as any).update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wedding_vendors"] }),
  });
}

export function useDeleteVendorPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wedding_vendor_payments" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wedding_vendors"] }),
  });
}

export async function uploadWeddingFile(file: File, path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("wedding-docs")
    .upload(path, file, { upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from("wedding-docs").getPublicUrl(data.path);
  return urlData.publicUrl;
}
