import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { formatCurrency, formatMonth } from "@/lib/formatters";
import { useRealizeCashFlowItem } from "@/hooks/useCashFlow";
import type { CashFlowMatch } from "@/hooks/useCashFlowMatch";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Check, X } from "lucide-react";

// Modal de sugestão de auto-vinculação. Aparece quando o usuário cria um
// expense/revenue e há matches em cash_flow_items projetados.

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  matches: CashFlowMatch[];
  realizedAmount: number;       // o valor que efetivamente foi pago/recebido
  realizedAtDate: string;       // YYYY-MM-DD
  onSkip?: () => void;          // se usuário clicar "Não corresponde"
}

export function CashFlowMatchDialog({
  open,
  onOpenChange,
  matches,
  realizedAmount,
  realizedAtDate,
  onSkip,
}: Props) {
  const realize = useRealizeCashFlowItem();
  const { toast } = useToast();

  if (matches.length === 0) return null;

  const handleConfirm = async (matchItemId: string, label: string) => {
    try {
      await realize.mutateAsync({
        id: matchItemId,
        realized_amount: realizedAmount,
        realized_at: realizedAtDate,
      });
      toast({
        title: "✓ Vinculado ao plano de caixa",
        description: `"${label}" marcado como realizado com R$ ${realizedAmount.toFixed(2)}`,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Erro ao vincular",
        description: e?.message ?? "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleSkip = () => {
    onSkip?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ background: "#0D1318", border: "1px solid #1A2535" }} className="max-w-lg">
        <DialogHeader>
          <DialogTitle style={{ color: "#E8C97A" }} className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Auto-realize: encontrei {matches.length === 1 ? "1 item projetado" : `${matches.length} itens projetados`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs" style={{ color: "#94A3B8" }}>
            Esse pagamento de <span className="font-mono" style={{ color: "#E8C97A" }}>{formatCurrency(realizedAmount)}</span> parece corresponder a:
          </p>

          {matches.map((m) => (
            <div
              key={m.item.id}
              className="p-3 rounded-lg space-y-2"
              style={{
                background: "rgba(201,168,76,0.05)",
                border: "1px solid rgba(201,168,76,0.2)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium" style={{ color: "#F0F4F8" }}>
                      {m.item.label}
                    </span>
                    <WtBadge variant={m.score >= 90 ? "green" : m.score >= 70 ? "gold" : "gray"}>
                      {m.score}% match
                    </WtBadge>
                  </div>
                  <p className="text-[10px] mt-1" style={{ color: "#94A3B8" }}>
                    {formatMonth(m.item.reference_month)} · {m.reason}
                    {m.item.notes ? ` · ${m.item.notes.slice(0, 80)}…` : ""}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono text-sm" style={{ color: "#94A3B8" }}>
                    Projetado:
                  </p>
                  <p className="font-mono text-sm font-bold" style={{ color: "#E8C97A" }}>
                    {formatCurrency(Number(m.item.amount))}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleConfirm(m.item.id, m.item.label)}
                disabled={realize.isPending}
                className="w-full text-xs py-1.5 rounded-lg flex items-center justify-center gap-1 disabled:opacity-50"
                style={{
                  background: "rgba(16,185,129,0.2)",
                  color: "#10B981",
                  border: "1px solid rgba(16,185,129,0.3)",
                }}
              >
                <Check className="w-3.5 h-3.5" /> Vincular como realizado
              </button>
            </div>
          ))}
        </div>

        <DialogFooter className="border-t pt-3" style={{ borderColor: "#1A2535" }}>
          <button
            onClick={handleSkip}
            className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
            style={{ background: "transparent", color: "#94A3B8", border: "1px solid #1A2535" }}
          >
            <X className="w-3.5 h-3.5" /> Nenhum corresponde — pular
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
