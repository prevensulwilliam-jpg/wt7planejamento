import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

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

export function useConstructionExpenses(propertyId?: string) {
  return useQuery({
    queryKey: ["construction_expenses", propertyId],
    queryFn: async () => {
      let q = supabase.from("construction_expenses").select("*").order("expense_date", { ascending: false });
      if (propertyId) q = q.eq("property_id", propertyId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    enabled: !!propertyId,
  });
}

export function useCreateConstructionExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: TablesInsert<"construction_expenses">) => {
      const { error } = await supabase.from("construction_expenses").insert(entry);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["construction_expenses"] }),
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

// Investments
export function useInvestments() {
  return useQuery({
    queryKey: ["investments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("investments").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateInvestment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: TablesInsert<"investments">) => {
      const { error } = await supabase.from("investments").insert(entry);
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
