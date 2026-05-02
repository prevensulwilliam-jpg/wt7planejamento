/**
 * MultiPeriodGoals — Gestão de metas multi-período.
 *
 * Add/edita metas com:
 *  - Métrica (revenue/patrimony/savings/profit/renda_passiva)
 *  - Período (monthly/quarterly/semestral/yearly/3y/5y/10y/custom)
 *  - Datas início + fim
 *  - Valor alvo
 *  - current_value calculado em runtime via useGoalsActive
 *
 * Integrado no /goals como seção complementar aos marcos canônicos.
 */
import { useState } from "react";
import { useGoalsActive, type GoalMetric, type GoalPeriodType } from "@/hooks/useGoalsActive";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GoldButton } from "./GoldButton";
import { PremiumCard } from "./PremiumCard";
import { formatCurrency } from "@/lib/formatters";
import { Target, Plus, Pencil, Trash2 } from "lucide-react";

const METRIC_LABELS: Record<GoalMetric, string> = {
  revenue: "💰 Receita",
  patrimony: "🏠 Patrimônio",
  savings: "💎 Sobra",
  profit: "📈 Lucro",
  renda_passiva: "🛋 Renda Passiva",
  custom: "🎯 Custom",
};

const PERIOD_LABELS: Record<GoalPeriodType, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semestral: "Semestral",
  yearly: "Anual",
  "3y": "3 anos",
  "5y": "5 anos",
  "10y": "10 anos",
  custom: "Custom",
};

// Semântica WT7: no_caminho = amarelo (não dourado)
const STATUS_COLORS = {
  atingida: "#10B981",
  perto: "#34D399",
  no_caminho: "#FBBF24",
  atras: "#F43F5E",
};

interface FormData {
  id?: string;
  name: string;
  metric: GoalMetric;
  period_type: GoalPeriodType;
  period_start: string;
  period_end: string;
  target_value: number;
  notes: string;
}

const emptyForm: FormData = {
  name: "",
  metric: "revenue",
  period_type: "monthly",
  period_start: new Date().toISOString().slice(0, 7) + "-01",
  period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
  target_value: 0,
  notes: "",
};

function calcEndDate(periodType: GoalPeriodType, startStr: string): string {
  const start = new Date(startStr);
  const end = new Date(start);
  switch (periodType) {
    case "monthly":
      end.setMonth(end.getMonth() + 1);
      end.setDate(0); // último dia do mês
      break;
    case "quarterly":
      end.setMonth(end.getMonth() + 3);
      end.setDate(end.getDate() - 1);
      break;
    case "semestral":
      end.setMonth(end.getMonth() + 6);
      end.setDate(end.getDate() - 1);
      break;
    case "yearly":
      end.setFullYear(end.getFullYear() + 1);
      end.setDate(end.getDate() - 1);
      break;
    case "3y":
      end.setFullYear(end.getFullYear() + 3);
      break;
    case "5y":
      end.setFullYear(end.getFullYear() + 5);
      break;
    case "10y":
      end.setFullYear(end.getFullYear() + 10);
      break;
    default:
      break;
  }
  return end.toISOString().slice(0, 10);
}

export function MultiPeriodGoals() {
  const { data: goals = [], isLoading } = useGoalsActive();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);

  const setF = <K extends keyof FormData>(k: K, v: FormData[K]) => setForm(f => ({ ...f, [k]: v }));

  const handleOpen = (goal?: any) => {
    if (goal) {
      setForm({
        id: goal.id,
        name: goal.name,
        metric: goal.metric ?? "revenue",
        period_type: goal.period_type ?? "monthly",
        period_start: goal.period_start ?? emptyForm.period_start,
        period_end: goal.period_end ?? emptyForm.period_end,
        target_value: goal.target_value ?? 0,
        notes: goal.notes ?? "",
      });
    } else {
      setForm(emptyForm);
    }
    setOpen(true);
  };

  const handlePeriodTypeChange = (newType: GoalPeriodType) => {
    setF("period_type", newType);
    if (newType !== "custom") {
      setF("period_end", calcEndDate(newType, form.period_start));
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.target_value) {
      toast({ title: "Nome e valor alvo são obrigatórios", variant: "destructive" });
      return;
    }
    // type legado tem CHECK (renda/patrimonio/imoveis/reserva/projeto/saude/outros).
    // metric novo tem (revenue/patrimony/savings/profit/renda_passiva/custom).
    // Mapeia metric → type pra não violar o constraint antigo.
    const metricToLegacyType: Record<GoalMetric, string> = {
      revenue: "renda",
      patrimony: "patrimonio",
      savings: "reserva",
      profit: "renda",
      renda_passiva: "renda",
      custom: "outros",
    };
    try {
      const payload: any = {
        name: form.name,
        type: metricToLegacyType[form.metric],
        metric: form.metric,
        period_type: form.period_type,
        period_start: form.period_start,
        period_end: form.period_end,
        deadline: form.period_end,
        target_value: form.target_value,
        notes: form.notes || null,
        auto_calculated: true,
      };
      let error: any = null;
      if (form.id) {
        const r = await (supabase as any).from("goals").update(payload).eq("id", form.id).select();
        error = r.error;
      } else {
        const r = await (supabase as any).from("goals").insert(payload).select();
        error = r.error;
      }
      if (error) {
        console.error("[goals save] error:", error);
        throw error;
      }
      toast({ title: form.id ? "Meta atualizada" : "Meta criada" });
      // Invalida TODAS as queries que dependem de goals
      qc.invalidateQueries({ queryKey: ["goals_active"] });
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["monthly_revenue_goal"] });
      await qc.refetchQueries({ queryKey: ["goals_active"] });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apagar essa meta?")) return;
    try {
      const { error } = await (supabase as any).from("goals").delete().eq("id", id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["goals_active"] });
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["monthly_revenue_goal"] });
      toast({ title: "Meta apagada" });
    } catch (e: any) {
      toast({ title: "Erro ao apagar", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) return <Skeleton className="h-64 rounded-xl" style={{ background: "#0D1318" }} />;

  return (
    <PremiumCard className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "#F0F4F8" }}>
            <Target className="w-5 h-5" style={{ color: "#C9A84C" }} />
            Metas Multi-Período
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "#94A3B8" }}>
            Mensal · Trimestral · Anual · 3y/5y/10y · current_value calculado automaticamente
          </p>
        </div>
        <GoldButton onClick={() => handleOpen()} className="flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Nova Meta
        </GoldButton>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-8" style={{ color: "#94A3B8" }}>
          <p className="text-sm">Nenhuma meta cadastrada.</p>
          <p className="text-xs mt-1">Click em <b style={{ color: "#C9A84C" }}>Nova Meta</b> pra começar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {goals.map(g => {
            const statusColor = STATUS_COLORS[g.status];
            const formatVal = g.metric === "patrimony" || (g.target_value ?? 0) > 100000
              ? formatCurrency(g.target_value)
              : formatCurrency(g.target_value);
            return (
              <div
                key={g.id}
                className="grid items-center gap-3 px-4 py-3 rounded-lg border group hover:translate-x-0.5 transition-transform"
                style={{
                  gridTemplateColumns: "auto 1fr auto auto",
                  background: "#0B1220",
                  borderColor: "#1C2333",
                }}
              >
                <span
                  className="px-2 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider"
                  style={{
                    background: `${statusColor}15`,
                    color: statusColor,
                    border: `1px solid ${statusColor}40`,
                  }}
                >
                  {g.metric ? METRIC_LABELS[g.metric].split(" ")[0] : "?"} {g.period_type ? PERIOD_LABELS[g.period_type] : ""}
                </span>
                <div className="min-w-0">
                  <b className="text-sm block truncate" style={{ color: "#F0F4F8" }}>{g.name}</b>
                  <span className="text-[10px] font-mono" style={{ color: "#64748B" }}>
                    {g.period_start} → {g.period_end}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold font-mono" style={{ color: statusColor }}>
                    {formatVal}
                  </div>
                  <div className="text-[10px] font-mono" style={{ color: "#94A3B8" }}>
                    {g.progress_pct.toFixed(1)}% · {formatCurrency(g.current_value)}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleOpen(g)} title="Editar" style={{ color: "#94A3B8" }}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(g.id)} title="Excluir" style={{ color: "#F43F5E" }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal create/edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "#F0F4F8" }}>
              {form.id ? "Editar Meta" : "Nova Meta"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label style={{ color: "#94A3B8" }}>Nome</Label>
              <Input
                value={form.name}
                onChange={e => setF("name", e.target.value)}
                placeholder="ex: Receita Anual 2026"
                style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label style={{ color: "#94A3B8" }}>Métrica</Label>
                <Select value={form.metric} onValueChange={v => setF("metric", v as GoalMetric)}>
                  <SelectTrigger style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
                    {Object.entries(METRIC_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label style={{ color: "#94A3B8" }}>Período</Label>
                <Select value={form.period_type} onValueChange={v => handlePeriodTypeChange(v as GoalPeriodType)}>
                  <SelectTrigger style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
                    {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label style={{ color: "#94A3B8" }}>Início</Label>
                <Input
                  type="date"
                  value={form.period_start}
                  onChange={e => {
                    setF("period_start", e.target.value);
                    if (form.period_type !== "custom") setF("period_end", calcEndDate(form.period_type, e.target.value));
                  }}
                  style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
                />
              </div>
              <div>
                <Label style={{ color: "#94A3B8" }}>Fim</Label>
                <Input
                  type="date"
                  value={form.period_end}
                  onChange={e => setF("period_end", e.target.value)}
                  style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
                />
              </div>
            </div>

            <div>
              <Label style={{ color: "#94A3B8" }}>Valor Alvo (R$)</Label>
              <Input
                type="number"
                value={form.target_value || ""}
                onChange={e => setF("target_value", parseFloat(e.target.value) || 0)}
                placeholder="ex: 720000"
                style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
              />
            </div>

            <div>
              <Label style={{ color: "#94A3B8" }}>Notas (opcional)</Label>
              <Textarea
                value={form.notes}
                onChange={e => setF("notes", e.target.value)}
                rows={2}
                style={{ background: "#080C10", border: "1px solid #1A2535", color: "#F0F4F8" }}
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ border: "1px solid #1A2535", color: "#94A3B8" }}
            >
              Cancelar
            </button>
            <GoldButton onClick={handleSave}>{form.id ? "Salvar" : "Criar"}</GoldButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PremiumCard>
  );
}
