import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NavalChat = {
  id: string;
  question: string;
  answer: string;
  asked_at: string;
  tools_used: string[] | null;
  tokens_in: number | null;
  tokens_cache_read: number | null;
  tokens_cache_write: number | null;
  tokens_out: number | null;
  version: string | null;
  feedback: "good" | "bad" | null;
};

/**
 * Lista o histórico de perguntas. Suporta busca textual.
 * O auto-cleanup de 7 dias é executado server-side por cron job.
 */
export function useNavalHistory(search?: string) {
  return useQuery<NavalChat[]>({
    queryKey: ["naval_chats", search ?? ""],
    queryFn: async () => {
      let query = (supabase as any)
        .from("naval_chats")
        .select("*")
        .order("asked_at", { ascending: false });

      // Busca textual: LIKE simples nos 2 campos (suficiente pra volumes baixos)
      if (search && search.trim().length >= 2) {
        const term = `%${search.trim()}%`;
        query = query.or(`question.ilike.${term},answer.ilike.${term}`);
      }

      query = query.limit(200);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as NavalChat[];
    },
    staleTime: 30 * 1000,
  });
}

/** Apaga TODOS os chats do usuário. */
export function useDeleteAllChats() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // RLS garante que só apaga os próprios. uuid() é trick pra deletar tudo.
      const { error } = await (supabase as any)
        .from("naval_chats")
        .delete()
        .gt("asked_at", "1900-01-01"); // condição sempre verdadeira → deleta tudo do user (RLS limita)
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["naval_chats"] }),
  });
}

/** Apaga 1 chat específico. */
export function useDeleteChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("naval_chats")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["naval_chats"] }),
  });
}
