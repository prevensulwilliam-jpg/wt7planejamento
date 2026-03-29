import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Trash2, Brain } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_LABELS, INTENT_CONFIG } from "@/lib/categorizeTransaction";

const ALL_LABELS: Record<string, string> = {
  ...CATEGORY_LABELS,
  cartao_credito: "Cartão de Crédito", energia_eletrica: "Energia Elétrica",
  internet: "Internet", telefonia: "Telefonia", lazer: "Lazer",
  alimentacao: "Alimentação", suplementos: "Suplementação", saude: "Saúde",
  maconaria: "Maçonaria", guarani: "Guarani", consorcio: "Consórcio",
  terapia: "Terapia", obras: "Obras", terrenos: "Terrenos",
  agua: "Água/Saneamento", gasolina: "Gasolina", farmacia: "Farmácia",
  academia: "Academia", impostos: "Impostos/Taxas", casamento: "Casamento",
  assinaturas: "Assinaturas", veiculo: "Veículo", outros: "Outros",
  kitnets: "Kitnets", salario: "Salário",
  comissao_prevensul: "Comissão Prevensul", solar: "Energia Solar",
  laudos: "Laudos", t7: "T7 Sales", dividendos: "Dividendos",
  outros_receita: "Outros (Receita)", transferencia: "Transferência entre Contas",
};

export default function PatternsPage() {
  const qc = useQueryClient();

  const { data: patterns = [], isLoading } = useQuery({
    queryKey: ["classification_patterns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classification_patterns" as any)
        .select("*")
        .order("count", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("classification_patterns" as any).delete().eq("id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classification_patterns"] });
      toast.success("Padrão removido.");
    },
  });

  const autoApply = patterns.filter(p => p.auto_apply);
  const learning = patterns.filter(p => !p.auto_apply);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6" style={{ color: "#8B5CF6" }} />
          <h1 className="font-display font-bold text-2xl" style={{ color: "#F0F4F8" }}>
            Padrões Aprendidos
          </h1>
        </div>
        <p className="text-sm mt-1" style={{ color: "#94A3B8" }}>
          O sistema aprende com suas classificações manuais e aplica automaticamente após 3x
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <PremiumCard>
          <p className="text-xs uppercase font-mono" style={{ color: "#94A3B8" }}>Automáticos</p>
          <p className="font-display font-bold text-3xl mt-1" style={{ color: "#8B5CF6" }}>{autoApply.length}</p>
          <p className="text-xs mt-1" style={{ color: "#4A5568" }}>classificados 3+ vezes</p>
        </PremiumCard>
        <PremiumCard>
          <p className="text-xs uppercase font-mono" style={{ color: "#94A3B8" }}>Aprendendo</p>
          <p className="font-display font-bold text-3xl mt-1" style={{ color: "#F59E0B" }}>{learning.length}</p>
          <p className="text-xs mt-1" style={{ color: "#4A5568" }}>menos de 3 classificações</p>
        </PremiumCard>
        <PremiumCard>
          <p className="text-xs uppercase font-mono" style={{ color: "#94A3B8" }}>Total</p>
          <p className="font-display font-bold text-3xl mt-1" style={{ color: "#F0F4F8" }}>{patterns.length}</p>
          <p className="text-xs mt-1" style={{ color: "#4A5568" }}>padrões registrados</p>
        </PremiumCard>
      </div>

      {/* Automáticos */}
      <PremiumCard glowColor="rgba(139,92,246,0.15)">
        <h3 className="font-display font-semibold mb-4" style={{ color: "#8B5CF6" }}>
          🧠 Automáticos — aplicados sem perguntar
        </h3>
        {autoApply.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: "#4A5568" }}>
            Nenhum padrão automático ainda. Classifique transações 3+ vezes para ativar.
          </p>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: "#1A2535" }}>
                  <TableHead style={{ color: "#94A3B8" }}>Padrão</TableHead>
                  <TableHead style={{ color: "#94A3B8" }}>Categoria</TableHead>
                  <TableHead style={{ color: "#94A3B8" }}>Tipo</TableHead>
                  <TableHead style={{ color: "#94A3B8" }}>Usos</TableHead>
                  <TableHead style={{ color: "#94A3B8" }}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {autoApply.map((p: any) => {
                  const intentCfg = INTENT_CONFIG[p.intent as keyof typeof INTENT_CONFIG];
                  return (
                    <TableRow key={p.id} style={{ borderColor: "#1A2535" }}>
                      <TableCell className="font-mono text-xs" style={{ color: "#F0F4F8" }}>
                        {p.description_pattern}
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: "#E8C97A" }}>
                        {ALL_LABELS[p.category] ?? p.category}
                      </TableCell>
                      <TableCell>
                        {intentCfg && <WtBadge variant={intentCfg.badge}>{intentCfg.label}</WtBadge>}
                      </TableCell>
                      <TableCell className="font-mono text-sm" style={{ color: "#F0F4F8" }}>
                        {p.count}x
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="p-1.5 rounded hover:opacity-80">
                              <Trash2 className="w-4 h-4" style={{ color: "#F43F5E" }} />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent style={{ background: "#0D1318", border: "1px solid #1A2535" }}>
                            <AlertDialogHeader>
                              <AlertDialogTitle style={{ color: "#F0F4F8" }}>Remover padrão?</AlertDialogTitle>
                              <AlertDialogDescription style={{ color: "#94A3B8" }}>
                                O sistema vai voltar a perguntar sobre "{p.description_pattern}".
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel style={{ color: "#94A3B8" }}>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMut.mutate(p.id)}
                                style={{ background: "#F43F5E", color: "white" }}>
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </PremiumCard>

      {/* Aprendendo */}
      {learning.length > 0 && (
        <PremiumCard>
          <h3 className="font-display font-semibold mb-4" style={{ color: "#F59E0B" }}>
            📚 Aprendendo — faltam classificações para virar automático
          </h3>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: "#1A2535" }}>
                  <TableHead style={{ color: "#94A3B8" }}>Padrão</TableHead>
                  <TableHead style={{ color: "#94A3B8" }}>Categoria</TableHead>
                  <TableHead style={{ color: "#94A3B8" }}>Tipo</TableHead>
                  <TableHead style={{ color: "#94A3B8" }}>Progresso</TableHead>
                  <TableHead style={{ color: "#94A3B8" }}></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {learning.map((p: any) => {
                  const intentCfg = INTENT_CONFIG[p.intent as keyof typeof INTENT_CONFIG];
                  return (
                    <TableRow key={p.id} style={{ borderColor: "#1A2535" }}>
                      <TableCell className="font-mono text-xs" style={{ color: "#F0F4F8" }}>
                        {p.description_pattern}
                      </TableCell>
                      <TableCell className="text-xs" style={{ color: "#E8C97A" }}>
                        {ALL_LABELS[p.category] ?? p.category}
                      </TableCell>
                      <TableCell>
                        {intentCfg && <WtBadge variant={intentCfg.badge}>{intentCfg.label}</WtBadge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={(p.count / 3) * 100} className="h-2 w-20" />
                          <span className="text-xs font-mono" style={{ color: "#94A3B8" }}>{p.count}/3</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <button onClick={() => deleteMut.mutate(p.id)} className="p-1.5 rounded hover:opacity-80">
                          <Trash2 className="w-4 h-4" style={{ color: "#F43F5E" }} />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </PremiumCard>
      )}
    </div>
  );
}
