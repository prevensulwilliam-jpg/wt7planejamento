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
    // Sempre refresca quando volta pra página (user pode ter saído enquanto Naval
    // ainda processava — quando volta, vê a nova resposta salva pela edge function)
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
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

/**
 * Salva uma memória permanente em naval_memory.
 * Naval vai usar essa info em TODAS as próximas sessões — não some.
 * Use pra: regras de negócio, decisões importantes, fatos que William quer
 * que Naval lembre pra sempre (até ele explicitamente apagar).
 */
export function useSaveMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { slug: string; title: string; content: string; priority?: number }) => {
      const { error } = await (supabase as any).from("naval_memory").upsert({
        slug: entry.slug,
        title: entry.title,
        content: entry.content,
        priority: entry.priority ?? 100, // 100 = adicionada pelo William, vai pro fim da lista
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["naval_memory"] }),
  });
}
