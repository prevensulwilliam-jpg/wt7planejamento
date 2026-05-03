/**
 * useLegalActions — CRUD da tabela legal_actions (módulo jurídico V1).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LegalArea =
  | "societario" | "tributario" | "familiar" | "sucessorio"
  | "imobiliario" | "ppci" | "trabalhista" | "consumidor" | "outro";

export type LegalStatus =
  | "pendente" | "em_reuniao" | "contratado" | "em_execucao"
  | "concluido" | "arquivado" | "bloqueado";

export type LegalPriority = "alta" | "media" | "baixa";

export type LegalProfessionalType =
  | "advogado" | "contador" | "despachante" | "cartorio" | "corretor" | "outro";

export interface LegalChecklistItem {
  step: string;
  done: boolean;
  done_at?: string | null;
  notes?: string | null;
}

export interface LegalAttachment {
  name: string;
  url: string;
  uploaded_at: string;
}

export interface LegalAction {
  id: string;
  title: string;
  description: string | null;
  area: LegalArea;
  status: LegalStatus;
  priority: LegalPriority;
  deadline: string | null;
  started_at: string | null;
  completed_at: string | null;
  professional_name: string | null;
  professional_type: LegalProfessionalType | null;
  professional_contact: string | null;
  briefing_md: string | null;
  notes: string | null;
  checklist: LegalChecklistItem[];
  cost_estimated_min: number | null;
  cost_estimated_max: number | null;
  cost_real: number | null;
  related_construction_id: string | null;
  related_business_id: string | null;
  related_kitnet_id: string | null;
  attachments: LegalAttachment[];
  created_at: string;
  updated_at: string;
}

export const AREA_LABEL: Record<LegalArea, { emoji: string; label: string; color: string }> = {
  societario:   { emoji: "🤝", label: "Societário",  color: "text-blue-300 bg-blue-300/10 border-blue-300/30" },
  tributario:   { emoji: "💰", label: "Tributário",  color: "text-green-300 bg-green-300/10 border-green-300/30" },
  familiar:     { emoji: "💍", label: "Familiar",    color: "text-pink-300 bg-pink-300/10 border-pink-300/30" },
  sucessorio:   { emoji: "📜", label: "Sucessório",  color: "text-purple-300 bg-purple-300/10 border-purple-300/30" },
  imobiliario:  { emoji: "🏠", label: "Imobiliário", color: "text-yellow-300 bg-yellow-300/10 border-yellow-300/30" },
  ppci:         { emoji: "🚒", label: "PPCI/Bombeiros", color: "text-red-300 bg-red-300/10 border-red-300/30" },
  trabalhista:  { emoji: "👔", label: "Trabalhista", color: "text-indigo-300 bg-indigo-300/10 border-indigo-300/30" },
  consumidor:   { emoji: "🛒", label: "Consumidor",  color: "text-orange-300 bg-orange-300/10 border-orange-300/30" },
  outro:        { emoji: "📋", label: "Outro",       color: "text-zinc-300 bg-zinc-300/10 border-zinc-300/30" },
};

export const STATUS_LABEL: Record<LegalStatus, { label: string; color: string }> = {
  pendente:    { label: "Pendente",    color: "text-zinc-300 bg-zinc-300/10 border-zinc-300/30" },
  em_reuniao:  { label: "Em reunião",  color: "text-blue-300 bg-blue-300/10 border-blue-300/30" },
  contratado:  { label: "Contratado",  color: "text-purple-300 bg-purple-300/10 border-purple-300/30" },
  em_execucao: { label: "Em execução", color: "text-yellow-300 bg-yellow-300/10 border-yellow-300/30" },
  concluido:   { label: "Concluído",   color: "text-green-300 bg-green-300/10 border-green-300/30" },
  arquivado:   { label: "Arquivado",   color: "text-zinc-500 bg-zinc-500/10 border-zinc-500/30" },
  bloqueado:   { label: "Bloqueado",   color: "text-red-300 bg-red-300/10 border-red-300/30" },
};

export const PRIORITY_LABEL: Record<LegalPriority, { label: string; color: string }> = {
  alta:  { label: "Alta",  color: "text-red-300" },
  media: { label: "Média", color: "text-yellow-300" },
  baixa: { label: "Baixa", color: "text-zinc-300" },
};

// ─── Listagem ──────────────────────────────────────────────────────────────
export function useLegalActions(opts?: { status?: LegalStatus | "todos" }) {
  return useQuery({
    queryKey: ["legal_actions", opts?.status ?? "todos"],
    queryFn: async () => {
      let q = (supabase as any)
        .from("legal_actions")
        .select("*")
        .order("priority", { ascending: true })
        .order("deadline", { ascending: true, nullsFirst: false });
      if (opts?.status && opts.status !== "todos") {
        q = q.eq("status", opts.status);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LegalAction[];
    },
  });
}

// ─── Resumo pro card no /hoje ──────────────────────────────────────────────
export function useLegalActionsSummary() {
  return useQuery({
    queryKey: ["legal_actions_summary"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("legal_actions")
        .select("id, status, priority, deadline")
        .neq("status", "arquivado");
      if (error) throw error;
      const list = (data ?? []) as Array<{ id: string; status: LegalStatus; priority: LegalPriority; deadline: string | null }>;

      const today = new Date().toISOString().slice(0, 10);
      const in30d = new Date(); in30d.setDate(in30d.getDate() + 30);
      const in30dStr = in30d.toISOString().slice(0, 10);

      return {
        total_active: list.filter((a) => !["concluido", "arquivado"].includes(a.status)).length,
        pendentes: list.filter((a) => a.status === "pendente").length,
        em_andamento: list.filter((a) => ["em_reuniao", "contratado", "em_execucao"].includes(a.status)).length,
        concluidos: list.filter((a) => a.status === "concluido").length,
        deadline_proxima: list.filter(
          (a) => a.deadline && a.deadline >= today && a.deadline <= in30dStr && !["concluido", "arquivado"].includes(a.status)
        ).length,
        deadline_estourada: list.filter(
          (a) => a.deadline && a.deadline < today && !["concluido", "arquivado"].includes(a.status)
        ).length,
        alta_prioridade_pendente: list.filter(
          (a) => a.priority === "alta" && !["concluido", "arquivado"].includes(a.status)
        ).length,
      };
    },
  });
}

// ─── Create ────────────────────────────────────────────────────────────────
export interface CreateLegalActionInput {
  title: string;
  description?: string | null;
  area: LegalArea;
  status?: LegalStatus;
  priority?: LegalPriority;
  deadline?: string | null;
  professional_name?: string | null;
  professional_type?: LegalProfessionalType | null;
  professional_contact?: string | null;
  briefing_md?: string | null;
  notes?: string | null;
  checklist?: LegalChecklistItem[];
  cost_estimated_min?: number | null;
  cost_estimated_max?: number | null;
}

export function useCreateLegalAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateLegalActionInput) => {
      const { data, error } = await (supabase as any)
        .from("legal_actions")
        .insert({
          ...input,
          status: input.status ?? "pendente",
          priority: input.priority ?? "media",
          checklist: input.checklist ?? [],
        })
        .select()
        .single();
      if (error) throw error;
      return data as LegalAction;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legal_actions"] });
      qc.invalidateQueries({ queryKey: ["legal_actions_summary"] });
    },
  });
}

// ─── Update ────────────────────────────────────────────────────────────────
export function useUpdateLegalAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<LegalAction> }) => {
      const { data, error } = await (supabase as any)
        .from("legal_actions")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as LegalAction;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legal_actions"] });
      qc.invalidateQueries({ queryKey: ["legal_actions_summary"] });
    },
  });
}

// ─── Toggle checklist item ─────────────────────────────────────────────────
export function useToggleChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ actionId, checklist, idx }: { actionId: string; checklist: LegalChecklistItem[]; idx: number }) => {
      const newChecklist = checklist.map((item, i) =>
        i === idx ? { ...item, done: !item.done, done_at: !item.done ? new Date().toISOString() : null } : item
      );
      const { error } = await (supabase as any)
        .from("legal_actions")
        .update({ checklist: newChecklist })
        .eq("id", actionId);
      if (error) throw error;
      return newChecklist;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legal_actions"] });
      qc.invalidateQueries({ queryKey: ["legal_actions_summary"] });
    },
  });
}

// ─── Delete ────────────────────────────────────────────────────────────────
export function useDeleteLegalAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("legal_actions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legal_actions"] });
      qc.invalidateQueries({ queryKey: ["legal_actions_summary"] });
    },
  });
}
