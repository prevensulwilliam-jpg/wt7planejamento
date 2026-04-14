import { useState } from "react";
import { Plus, Pencil, Trash2, Landmark } from "lucide-react";
import { KpiCard } from "@/components/wt7/KpiCard";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useBankAccounts, useCreateBankAccount, useUpdateBankAccount, useDeleteBankAccount } from "@/hooks/useFinances";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/wt7/DatePicker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const accountTypes = [
  { value: "corrente",    label: "Conta Corrente"   },
  { value: "poupanca",    label: "Poupança"          },
  { value: "investimento",label: "Investimento"      },
  { value: "digital",     label: "Carteira Digital"  },
];

const typeBadgeVariant: Record<string, 'gold' | 'green' | 'cyan' | 'gray'> = {
  corrente: 'cyan', poupanca: 'green', investimento: 'gold', digital: 'gray',
};

export default function BanksPage() {
  const { data = [], isLoading } = useBankAccounts();
  const createAccount = useCreateBankAccount();
  const updateAccount = useUpdateBankAccount();
  const deleteAccount = useDeleteBankAccount();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId]         = useState<string | null>(null);
  const [form, setForm]             = useState({
    bank_name: "", account_type: "corrente", balance: "", last_updated: "", notes: "",
  });

  const totalBalance = data.reduce((s, a) => s + (a.balance ?? 0), 0);

  const handleSubmit = async () => {
    if (!form.bank_name) return;
    try {
      if (editId) {
        await updateAccount.mutateAsync({
          id: editId,
          bank_name:    form.bank_name,
          account_type: form.account_type,
          balance:      parseFloat(form.balance) || 0,
          last_updated: form.last_updated || null,
          notes:        form.notes || null,
        });
        toast({ title: "Conta atualizada" });
      } else {
        await createAccount.mutateAsync({
          bank_name:    form.bank_name,
          account_type: form.account_type,
          balance:      parseFloat(form.balance) || 0,
          last_updated: form.last_updated || null,
          notes:        form.notes || null,
        });
        toast({ title: "Conta adicionada" });
      }
      setDialogOpen(false);
      setEditId(null);
      setForm({ bank_name: "", account_type: "corrente", balance: "", last_updated: "", notes: "" });
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const openEdit = (acc: any) => {
    setEditId(acc.id);
    setForm({
      bank_name:    acc.bank_name,
      account_type: acc.account_type ?? "corrente",
      balance:      String(acc.balance ?? 0),
      last_updated: acc.last_updated ?? "",
      notes:        acc.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAccount.mutateAsync(id);
      toast({ title: "Conta removida" });
    } catch {
      toast({ title: "Erro ao remover", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-xl text-wt-text-primary">Bancos & Caixas</h1>

        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) { setEditId(null); setForm({ bank_name: "", account_type: "corrente", balance: "", last_updated: "", notes: "" }); } }}>
          <DialogTrigger asChild>
            <GoldButton><Plus className="w-4 h-4" />Adicionar Conta</GoldButton>
          </DialogTrigger>
          <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
            <DialogHeader>
              <DialogTitle style={{ color: '#F0F4F8' }}>{editId ? "Editar Conta" : "Nova Conta"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label style={{ color: '#94A3B8' }}>Banco</Label>
                <Input
                  value={form.bank_name}
                  onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                  placeholder="Ex: Nubank, Bradesco, BB Saldo Dia"
                  style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }}
                />
              </div>
              <div>
                <Label style={{ color: '#94A3B8' }}>Tipo</Label>
                <Select value={form.account_type} onValueChange={v => setForm(f => ({ ...f, account_type: v }))}>
                  <SelectTrigger style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }}><SelectValue /></SelectTrigger>
                  <SelectContent style={{ background: '#0D1318', borderColor: '#1A2535' }}>
                    {accountTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label style={{ color: '#94A3B8' }}>Saldo Atual (R$)</Label>
                <Input
                  type="number"
                  value={form.balance}
                  onChange={e => setForm(f => ({ ...f, balance: e.target.value }))}
                  style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }}
                />
              </div>
              <div>
                <Label style={{ color: '#94A3B8' }}>Última Atualização</Label>
                <DatePicker value={form.last_updated} onChange={v => setForm(f => ({ ...f, last_updated: v }))} />
              </div>
              <div>
                <Label style={{ color: '#94A3B8' }}>Observações</Label>
                <Textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }}
                />
              </div>
              <GoldButton
                onClick={handleSubmit}
                disabled={createAccount.isPending || updateAccount.isPending}
                className="w-full justify-center"
              >
                {editId ? "Atualizar" : "Adicionar"}
              </GoldButton>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <KpiCard label="Saldo Consolidado" value={totalBalance} color="gold" />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[180px] rounded-2xl" style={{ background: '#0D1318' }} />
          ))}
        </div>
      ) : data.length === 0 ? (
        <PremiumCard>
          <div className="text-center py-12" style={{ color: '#4A5568' }}>
            <Landmark className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhuma conta cadastrada</p>
          </div>
        </PremiumCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map(acc => (
            <PremiumCard key={acc.id}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏦</span>
                  <h3 className="font-display font-bold text-sm" style={{ color: '#F0F4F8' }}>{acc.bank_name}</h3>
                </div>
                <WtBadge variant={typeBadgeVariant[acc.account_type ?? ''] ?? 'gray'}>
                  {accountTypes.find(t => t.value === acc.account_type)?.label ?? acc.account_type}
                </WtBadge>
              </div>

              <p className="font-mono text-2xl font-medium mb-2" style={{ color: (acc.balance ?? 0) < 0 ? '#F43F5E' : '#E8C97A' }}>
                {formatCurrency(acc.balance ?? 0)}
              </p>

              <p className="text-xs font-mono mb-4" style={{ color: '#4A5568' }}>
                Atualizado: {acc.last_updated ? formatDate(acc.last_updated) : '—'}
              </p>

              {acc.notes && <p className="text-xs mb-4" style={{ color: '#94A3B8' }}>{acc.notes}</p>}

              <div className="flex gap-2">
                <button onClick={() => openEdit(acc)} className="text-wt-text-muted hover:text-wt-text-primary">
                  <Pencil className="w-4 h-4" />
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="text-wt-text-muted hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </AlertDialogTrigger>
                  <AlertDialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                    <AlertDialogHeader>
                      <AlertDialogTitle style={{ color: '#F0F4F8' }}>Excluir "{acc.bank_name}"?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(acc.id)} className="bg-red-600 hover:bg-red-700">
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </PremiumCard>
          ))}
        </div>
      )}
    </div>
  );
}
