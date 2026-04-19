// Hook CRUD da biblioteca mental do Naval (brain stack).
// Cada source = livro/artigo/nota destilado em princípios operativos.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NavalLens = "naval" | "aaron_ross" | "housel" | "tevah" | "operador" | "outros";
export type NavalSourceType = "book" | "video" | "article" | "podcast" | "note" | "course";

export interface NavalSource {
  id: string;
  slug: string;
  title: string;
  author: string | null;
  source_type: NavalSourceType;
  source_url: string | null;
  lens: NavalLens;
  summary: string | null;
  principles: string[];
  active: boolean;
  priority: number;
  raw_content: string | null;
  ingested_at: string;
  updated_at: string;
}

export const LENS_LABEL: Record<NavalLens, string> = {
  naval: "Naval — Leverage & Longo Prazo",
  aaron_ross: "Aaron Ross — Receita Previsível",
  housel: "Housel — Psicologia do Dinheiro",
  tevah: "Tevah — Venda Consultiva",
  operador: "Operador — Realidade do Terreno",
  outros: "Outros",
};

export const LENS_COLOR: Record<NavalLens, string> = {
  naval: "text-yellow-400 border-yellow-400/30",
  aaron_ross: "text-blue-400 border-blue-400/30",
  housel: "text-purple-400 border-purple-400/30",
  tevah: "text-green-400 border-green-400/30",
  operador: "text-orange-400 border-orange-400/30",
  outros: "text-zinc-400 border-zinc-400/30",
};

// ── Listagem ──
export function useNavalSources(opts?: { onlyActive?: boolean }) {
  return useQuery({
    queryKey: ["naval_sources", opts?.onlyActive ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("naval_sources")
        .select("*")
        .order("priority", { ascending: true })
        .order("updated_at", { ascending: false });
      if (opts?.onlyActive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as NavalSource[];
    },
  });
}

// ── Ingest: destila via edge function, NÃO salva ainda ──
export interface IngestInput {
  mode: "pdf" | "url" | "text";
  pdfBase64?: string;
  mediaType?: string;
  url?: string;
  rawText?: string;
  hint?: string;
}

export interface IngestDraft {
  title: string;
  author: string;
  lens: NavalLens;
  summary: string;
  principles: string[];
}

export function useIngestNavalSource() {
  return useMutation({
    mutationFn: async (input: IngestInput): Promise<IngestDraft> => {
      const { data, error } = await supabase.functions.invoke("naval-ingest", { body: input });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Falha na destilação");
      return data.draft as IngestDraft;
    },
  });
}

// ── Create (após revisão) ──
export interface CreateInput {
  slug: string;
  title: string;
  author?: string | null;
  source_type: NavalSourceType;
  source_url?: string | null;
  lens: NavalLens;
  summary?: string | null;
  principles: string[];
  priority?: number;
  active?: boolean;
}

export function useCreateNavalSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInput) => {
      const { data, error } = await supabase
        .from("naval_sources")
        .insert({
          ...input,
          priority: input.priority ?? 100,
          active: input.active ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      return data as NavalSource;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["naval_sources"] }),
  });
}

// ── Update (edição, toggle active, reordenar) ──
export interface UpdateInput {
  id: string;
  patch: Partial<Omit<NavalSource, "id" | "ingested_at">>;
}

export function useUpdateNavalSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: UpdateInput) => {
      const { data, error } = await supabase
        .from("naval_sources")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as NavalSource;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["naval_sources"] }),
  });
}

// ── Delete ──
export function useDeleteNavalSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("naval_sources").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["naval_sources"] }),
  });
}

// ── Helper: slug a partir de título ──
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
