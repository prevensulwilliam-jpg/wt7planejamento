import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTaxes, useCreateTax, useUpdateTax, useDebts, useCreateDebt, useUpdateDebt } from "@/hooks/useConstructions";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { Receipt, Plus, Check, AlertTriangle } from "lucide-react";

function getTaxStatus(tax: { due_date?: string | null; status?: string | null }) {
  if (tax.status === "pago") return { label: "Pago", variant: "green" as const, icon: "🟢" };
  if (!tax.due_date) return { label: "Pendente", variant: "gray" as const, icon: "⚪" };
  const due = new Date(tax.due_date);
  const now = new Date();
  const diff = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return { label: "Vencido", variant: "red" as const, icon: "🔴" };
  if (diff < 30) return { label: "Vence em breve", variant: "gold" as const, icon: "🟡" };
  return { label: "Pendente", variant: "gray" as const, icon: "⚪" };
}

export default function TaxesPage() {
  const { data: taxes, isLoading: taxLoading } = useTaxes();
  const createTax = useCreateTax();
  const updateTax = useUpdateTax();
  const { data: debts, isLoading: debtLoading } = useDebts();
  const createDebt = useCreateDebt();
  const updateDebt = useUpdateDebt();
  const { toast } = useToast();
  const [taxOpen, setTaxOpen] = useState(false);
  const [debtOpen, setDebtOpen] = useState(false);
  const [taxForm, setTaxForm] = useState({ name: "", type: "IPTU", amount: "", due_date: "", reference_year: String(new Date().getFullYear()) });
  const [debtForm, setDebtForm] = useState({ name: "", creditor: "", total_amount: "", remaining_amount: "", monthly_payment: "", due_date: "", status: "ativo" });

  const overdue = (taxes ?? []).filter(t => getTaxStatus(t).variant === "red");
  const soon = (taxes ?? []).filter(t => getTaxStatus(t).variant === "gold");

  const handleCreateTax = async () => {
    if (!taxForm.name || !taxForm.amount) return;
    try {
      await createTax.mutateAsync({ name: taxForm.name, type: taxForm.type, amount: parseFloat(taxForm.amount), due_date: taxForm.due_date || null, reference_year: parseInt(taxForm.reference_year) || null, status: "pendente" });
      toast({ title: "Obrigação criada!" }); setTaxOpen(false);
      setTaxForm({ name: "", type: "IPTU", amount: "", due_date: "", reference_year: String(new Date().getFullYear()) });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await updateTax.mutateAsync({ id, status: "pago", paid_at: new Date().toISOString().split("T")[0] });
      toast({ title: "Marcado como pago!" });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  const handleCreateDebt = async () => {
    if (!debtForm.name || !debtForm.total_amount) return;
    try {
      await createDebt.mutateAsync({ name: debtForm.name, creditor: debtForm.creditor || null, total_amount: parseFloat(debtForm.total_amount), remaining_amount: parseFloat(debtForm.remaining_amount) || parseFloat(debtForm.total_amount), monthly_payment: parseFloat(debtForm.monthly_payment) || null, due_date: debtForm.due_date || null, status: debtForm.status });
      toast({ title: "Dívida registrada!" }); setDebtOpen(false);
      setDebtForm({ name: "", creditor: "", total_amount: "", remaining_amount: "", monthly_payment: "", due_date: "", status: "ativo" });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  const inputStyle = { background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' };

  return (
    <div className="space-y-6">
      <h1 className="font-display font-bold text-2xl" style={{ color: '#F0F4F8' }}>
        <Receipt className="inline w-6 h-6 mr-2" style={{ color: '#C9A84C' }} />
        Impostos & Dívidas
      </h1>

      {(overdue.length > 0 || soon.length > 0) && (
        <PremiumCard glowColor="#F43F5E" className="space-y-2">
          <p className="font-display font-bold flex items-center gap-2" style={{ color: '#F43F5E' }}><AlertTriangle className="w-5 h-5" />Atenção</p>
          {overdue.map(t => <p key={t.id} className="text-sm" style={{ color: '#F43F5E' }}>🔴 {t.name} — Vencido em {t.due_date ? formatDate(t.due_date) : "?"} — {formatCurrency(t.amount ?? 0)}</p>)}
          {soon.map(t => <p key={t.id} className="text-sm" style={{ color: '#E8C97A' }}>🟡 {t.name} — Vence {t.due_date ? formatDate(t.due_date) : "?"} — {formatCurrency(t.amount ?? 0)}</p>)}
        </PremiumCard>
      )}

      <Tabs defaultValue="impostos">
        <TabsList style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <TabsTrigger value="impostos">Impostos</TabsTrigger>
          <TabsTrigger value="dividas">Dívidas</TabsTrigger>
        </TabsList>

        <TabsContent value="impostos" className="space-y-4">
          <div className="flex justify-end"><GoldButton onClick={() => setTaxOpen(true)}><Plus className="w-4 h-4" />Nova Obrigação</GoldButton></div>
          {taxLoading ? <Skeleton className="h-32 rounded-2xl" /> : (taxes ?? []).length === 0 ? (
            <PremiumCard><p className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhuma obrigação cadastrada</p></PremiumCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(taxes ?? []).map(t => {
                const s = getTaxStatus(t);
                return (
                  <PremiumCard key={t.id} className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-display font-bold" style={{ color: '#F0F4F8' }}>{s.icon} {t.name}</p>
                        <p className="text-xs" style={{ color: '#94A3B8' }}>{t.type} · {t.reference_year}</p>
                      </div>
                      <WtBadge variant={s.variant}>{s.label}</WtBadge>
                    </div>
                    <p className="font-mono text-xl" style={{ color: '#E8C97A' }}>{formatCurrency(t.amount ?? 0)}</p>
                    {t.due_date && <p className="text-xs" style={{ color: '#94A3B8' }}>Vencimento: {formatDate(t.due_date)}</p>}
                    {t.status !== "pago" && (
                      <GoldButton className="text-xs py-1 px-3" onClick={() => handleMarkPaid(t.id)}>
                        <Check className="w-3 h-3" />Pago
                      </GoldButton>
                    )}
                  </PremiumCard>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="dividas" className="space-y-4">
          <div className="flex justify-end"><GoldButton onClick={() => setDebtOpen(true)}><Plus className="w-4 h-4" />Nova Dívida</GoldButton></div>
          {debtLoading ? <Skeleton className="h-32 rounded-2xl" /> : (debts ?? []).length === 0 ? (
            <PremiumCard><p className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhuma dívida cadastrada</p></PremiumCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(debts ?? []).map(d => {
                const pago = (d.total_amount ?? 0) - (d.remaining_amount ?? 0);
                const pct = d.total_amount ? (pago / d.total_amount) * 100 : 0;
                return (
                  <PremiumCard key={d.id} className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div><p className="font-display font-bold" style={{ color: '#F0F4F8' }}>{d.name}</p><p className="text-xs" style={{ color: '#94A3B8' }}>{d.creditor}</p></div>
                      <WtBadge variant={d.status === "quitado" ? "green" : "gold"}>{d.status}</WtBadge>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><p className="text-xs" style={{ color: '#94A3B8' }}>Total</p><p className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(d.total_amount ?? 0)}</p></div>
                      <div><p className="text-xs" style={{ color: '#94A3B8' }}>Restante</p><p className="font-mono" style={{ color: '#F43F5E' }}>{formatCurrency(d.remaining_amount ?? 0)}</p></div>
                      <div><p className="text-xs" style={{ color: '#94A3B8' }}>Parcela</p><p className="font-mono" style={{ color: '#F0F4F8' }}>{formatCurrency(d.monthly_payment ?? 0)}</p></div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs" style={{ color: '#94A3B8' }}><span>{formatCurrency(pago)} pago</span><span>{pct.toFixed(0)}%</span></div>
                      <Progress value={pct} className="h-2" />
                    </div>
                    {d.due_date && <p className="text-xs" style={{ color: '#94A3B8' }}>Vencimento: {formatDate(d.due_date)}</p>}
                  </PremiumCard>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Tax modal */}
      <Dialog open={taxOpen} onOpenChange={setTaxOpen}>
        <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>Nova Obrigação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label style={{ color: '#94A3B8' }}>Nome</Label><Input value={taxForm.name} onChange={e => setTaxForm({ ...taxForm, name: e.target.value })} style={inputStyle} /></div>
            <div><Label style={{ color: '#94A3B8' }}>Tipo</Label>
              <Select value={taxForm.type} onValueChange={v => setTaxForm({ ...taxForm, type: v })}>
                <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                  {["IPTU","IPVA","IR","DAS","ISS","Outros"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label style={{ color: '#94A3B8' }}>Valor</Label><Input type="number" value={taxForm.amount} onChange={e => setTaxForm({ ...taxForm, amount: e.target.value })} style={inputStyle} /></div>
              <div><Label style={{ color: '#94A3B8' }}>Ano Ref.</Label><Input type="number" value={taxForm.reference_year} onChange={e => setTaxForm({ ...taxForm, reference_year: e.target.value })} style={inputStyle} /></div>
            </div>
            <div><Label style={{ color: '#94A3B8' }}>Vencimento</Label><Input type="date" value={taxForm.due_date} onChange={e => setTaxForm({ ...taxForm, due_date: e.target.value })} style={inputStyle} /></div>
          </div>
          <DialogFooter><GoldButton onClick={handleCreateTax}>Criar</GoldButton></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Debt modal */}
      <Dialog open={debtOpen} onOpenChange={setDebtOpen}>
        <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>Nova Dívida</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label style={{ color: '#94A3B8' }}>Nome</Label><Input value={debtForm.name} onChange={e => setDebtForm({ ...debtForm, name: e.target.value })} style={inputStyle} /></div>
            <div><Label style={{ color: '#94A3B8' }}>Credor</Label><Input value={debtForm.creditor} onChange={e => setDebtForm({ ...debtForm, creditor: e.target.value })} style={inputStyle} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label style={{ color: '#94A3B8' }}>Valor Total</Label><Input type="number" value={debtForm.total_amount} onChange={e => setDebtForm({ ...debtForm, total_amount: e.target.value })} style={inputStyle} /></div>
              <div><Label style={{ color: '#94A3B8' }}>Saldo Restante</Label><Input type="number" value={debtForm.remaining_amount} onChange={e => setDebtForm({ ...debtForm, remaining_amount: e.target.value })} style={inputStyle} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label style={{ color: '#94A3B8' }}>Parcela Mensal</Label><Input type="number" value={debtForm.monthly_payment} onChange={e => setDebtForm({ ...debtForm, monthly_payment: e.target.value })} style={inputStyle} /></div>
              <div><Label style={{ color: '#94A3B8' }}>Vencimento</Label><Input type="date" value={debtForm.due_date} onChange={e => setDebtForm({ ...debtForm, due_date: e.target.value })} style={inputStyle} /></div>
            </div>
          </div>
          <DialogFooter><GoldButton onClick={handleCreateDebt}>Registrar</GoldButton></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
