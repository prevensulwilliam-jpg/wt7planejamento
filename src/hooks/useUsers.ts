import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Pending users (status = 'pending') ───
export function usePendingUsers() {
  return useQuery({
    queryKey: ["users_pending"],
    queryFn: async () => {
      const { data: roles, error } = await (supabase as any)
        .from("user_roles")
        .select("user_id, role, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = (roles ?? []).map(r => r.user_id);
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);

      return (roles ?? []).map(r => ({
        user_id: r.user_id,
        role: r.role,
        status: (r as any).status,
        requested_at: (r as any).created_at,
        name: (profiles ?? []).find(p => p.id === r.user_id)?.name ?? "—",
      }));
    },
    refetchInterval: 30_000,
  });
}

// ─── Approve user ───
export function useApproveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase as any)
        .from("user_roles")
        .update({ status: "active" })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users_pending"] });
      qc.invalidateQueries({ queryKey: ["users_with_roles"] });
    },
  });
}

// ─── Reject user ───
export function useRejectUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase as any)
        .from("user_roles")
        .update({ status: "rejected" })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users_pending"] });
      qc.invalidateQueries({ queryKey: ["users_with_roles"] });
    },
  });
}

// ─── Login history ───
export function useLoginHistory(userId?: string) {
  return useQuery({
    queryKey: ["login_history", userId],
    queryFn: async () => {
      let q = (supabase as any)
        .from("login_history")
        .select("id, user_id, logged_at, user_agent")
        .order("logged_at", { ascending: false })
        .limit(100);
      if (userId) q = q.eq("user_id", userId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; user_id: string; logged_at: string; user_agent: string | null }>;
    },
    enabled: true,
  });
}

// ─── Pending count (for badge) ───
export function usePendingCount() {
  return useQuery({
    queryKey: ["users_pending_count"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });
}
