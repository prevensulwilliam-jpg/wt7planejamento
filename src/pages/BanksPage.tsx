import { useState } from "react";
import { Plus, Pencil, Trash2, Landmark, ChevronRight, Check, X } from "lucide-react";
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
  { value: "corrente", label: "Conta Corrente" },
  { value: "poupanca", label: "Poupança" },
  { value: "investimento", label: "Investimento" },
  { value: "digital", label: "Carteira Digital" },
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
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ bank_name: "", account_type: "corrente", balance: "", last_updated: "", notes: "" });

  // BB detail modal
  const [bbDetailOpen, setBbDetailOpen] = useState(false);
  const [editingRF, setEditingRF] = useState(false);
  const [editRFValue, setEditRFValue] = useState("");

  // Separar contas BB das demais
  const bbAccounts = data.filter(a => a.bank_name?.startsWith("BB "));
  const otherAccounts = data.filter(a => !a.bank_name?.startsWith("BB "));
  const bbSaldoDia = bbAccounts.find(a => a.bank_name === "BB Saldo Dia");
  const bbRendeFacil = bbAccounts.find(a => a.bank_name === "BB Rende Fácil");
  const bbTotal = bbAccounts.reduce((s, a) => s + (a.balance ?? 0), 0);

  const totalBalance = data.reduce((s, a) => s + (a.balance ?? 0), 0);

  const handleSubmit = async () => {
    if (!form.bank_name) return;
    try {
      if (editId) {
        await updateAccount.mutateAsync({ id: editId, balance: parseFloat(form.balance) || 0, last_updated: form.last_updated || null, bank_name: form.bank_name, account_type: form.account_type, notes: form.notes || null });
        toast({ title: "Conta atualizada" });
      } else {
        await createAccount.mutateAsync({ bank_name: form.bank_name, account_type: form.account_type, balance: parseFloat(form.balance) || 0, last_updated: form.last_updated || null, notes: form.notes || null });
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
    setForm({ bank_name: acc.bank_name, account_type: acc.account_type ?? "corrente", balance: String(acc.balance ?? 0), last_updated: acc.last_updated ?? "", notes: acc.notes ?? "" });
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

  const saveRFBalance = async () => {
    if (!bbRendeFacil) return;
    try {
      await updateAccount.mutateAsync({
        id: bbRendeFacil.id,
        balance: parseFloat(editRFValue) || 0,
        last_updated: new Date().toISOString().split('T')[0],
      });
      toast({ title: "Saldo Rende Fácil atualizado" });
      setEditingRF(false);
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-xl text-wt-text-primary">Bancos & Caixas</h1>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) setEditId(null); }}>
          <DialogTrigger asChild>
            <GoldButton><Plus className="w-4 h-4" /> Adicionar Conta</GoldButton>
          </DialogTrigger>
          <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
            <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>{editId ? "Editar Conta" : "Nova Conta"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label style={{ color: '#94A3B8' }}>Banco</Label>
                <Input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="Ex: Nubank, Bradesco" style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }} />
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
                <Input type="number" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }} />
              </div>
              <div>
                <Label style={{ color: '#94A3B8' }}>Última Atualização</Label>
                <DatePicker value={form.last_updated} onChange={v => setForm(f => ({ ...f, last_updated: v }))} />
              </div>
              <div>
                <Label style={{ color: '#94A3B8' }}>Observações</Label>
                <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }} />
              </div>
              <GoldButton onClick={handleSubmit} disabled={createAccount.isPending || updateAccount.isPending} className="w-full justify-center">
                {editId ? "Atualizar" : "Adicionar"}
              </GoldButton>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <KpiCard label="Saldo Consolidado" value={totalBalance} color="gold" />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[180px] rounded-2xl" style={{ background: '#0D1318' }} />)}
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

          {/* Card BB Total (agrupa todas as contas "BB *") */}
          {bbAccounts.length > 0 && (
            <>
              <PremiumCard
                style={{ cursor: 'pointer' }}
                onClick={() => setBbDetailOpen(true)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏦</span>
                    <h3 className="font-display font-bold text-sm" style={{ color: '#F0F4F8' }}>Banco do Brasil</h3>
                  </div>
                  <WtBadge variant="cyan">BB Total</WtBadge>
                </div>
                <p className="font-mono text-2xl font-medium mb-2" style={{ color: '#E8C97A' }}>{formatCurrency(bbTotal)}</p>
                <p className="text-xs font-mono mb-4" style={{ color: '#4A5568' }}>
                  Atualizado: {bbSaldoDia?.last_updated ? formatDate(bbSaldoDia.last_updated) : '—'}
                </p>
                <div className="flex items-center gap-1 text-xs" style={{ color: '#C9A84C' }}>
                  <span>ver detalhes</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </PremiumCard>

              {/* Modal de detalhes BB */}
              <Dialog open={bbDetailOpen} onOpenChange={o => { setBbDetailOpen(o); if (!o) setEditingRF(false); }}>
                <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                  <DialogHeader>
                    <DialogTitle style={{ color: '#F0F4F8' }}>🏦 Banco do Brasil — Detalhes</DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4 pt-2">
                    {/* BB Saldo Dia */}
                    <div className="rounded-xl p-4" style={{ background: '#080C10', border: '1px solid #1A2535' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium" style={{ color: '#94A3B8' }}>💳 Saldo Dia (CC)</span>
                        <span className="text-xs font-mono" style={{ color: '#4A5568' }}>
                          {bbSaldoDia?.last_updated ? formatDate(bbSaldoDia.last_updated) : '—'}
                        </span>
                      </div>
                      <p
                        className="font-mono text-xl font-bold"
                        style={{ color: (bbSaldoDia?.balance ?? 0) < 0 ? '#F43F5E' : '#E8C97A' }}
                      >
                        {formatCurrency(bbSaldoDia?.balance ?? 0)}
                      </p>
                      <p className="text-xs mt-1" style={{ color: '#4A5568' }}>Atualizado automaticamente via OFX</p>
                    </div>

                    {/* BB Rende Fácil — só exibe se conta existir no banco */}
                    {bbRendeFacil && (
                    <div className="rounded-xl p-4" style={{ background: '#080C10', border: '1px solid #1A2535' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium" style={{ color: '#94A3B8' }}>📈 Rende Fácil</span>
                        <span className="text-xs font-mono" style={{ color: '#4A5568' }}>
                          {bbRendeFacil.last_updated ? formatDate(bbRendeFacil.last_updated) : '—'}
                        </span>
                      </div>

                      {editingRF ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            type="number"
                            value={editRFValue}
                            onChange={e => setEditRFValue(e.target.value)}
                            autoFocus
                            style={{ background: '#0D1318', borderColor: '#C9A84C', color: '#F0F4F8', height: '36px' }}
                          />
                          <button onClick={saveRFBalance} className="text-green-400 hover:text-green-300"><Check className="w-5 h-5" /></button>
                          <button onClick={() => setEditingRF(false)} className="text-red-400 hover:text-red-300"><X className="w-5 h-5" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-xl font-bold" style={{ color: '#E8C97A' }}>
                            {formatCurrency(bbRendeFacil.balance ?? 0)}
                          </p>
                          <button
                            onClick={() => { setEditRFValue(String(bbRendeFacil.balance ?? 0)); setEditingRF(true); }}
                            className="text-wt-text-muted hover:text-wt-text-primary"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      <p className="text-xs mt-1" style={{ color: '#4A5568' }}>Atualizado automaticamente via OFX · editável manualmente</p>
                    </div>
                    )}

                    {/* Linha total */}
                    <div
                      className="rounded-xl p-4 flex items-center justify-between"
                      style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)' }}
                    >
                      <span className="font-display font-bold text-sm" style={{ color: '#E8C97A' }}>BB Total</span>
                      <span className="font-mono text-xl font-bold" style={{ color: '#E8C97A' }}>{formatCurrency(bbTotal)}</span>
                    </div>
                  </div>

                  {/* Editar/excluir contas individuais */}
                  <div className="flex gap-2 pt-2 border-t" style={{ borderColor: '#1A2535' }}>
                    {bbAccounts.map(acc => (
                      <div key={acc.id} className="flex items-center gap-1">
                        <span className="text-xs" style={{ color: '#4A5568' }}>{acc.bank_name}</span>
                        <button onClick={() => { setBbDetailOpen(false); openEdit(acc); }} className="text-wt-text-muted hover:text-wt-text-primary"><Pencil className="w-3 h-3" /></button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="text-wt-text-muted hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                          </AlertDialogTrigger>
                          <AlertDialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                            <AlertDialogHeader>
                              <AlertDialogTitle style={{ color: '#F0F4F8' }}>Excluir {acc.bank_name}?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(acc.id)} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}

          {/* Demais contas (não-BB) */}
          {otherAccounts.map(acc => (
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
              <p className="font-mono text-2xl font-medium mb-2" style={{ color: '#E8C97A' }}>{formatCurrency(acc.balance ?? 0)}</p>
              <p className="text-xs font-mono mb-4" style={{ color: '#4A5568' }}>
                Atualizado: {acc.last_updated ? formatDate(acc.last_updated) : '—'}
              </p>
              {acc.notes && <p className="text-xs mb-4" style={{ color: '#94A3B8' }}>{acc.notes}</p>}
              <div className="flex gap-2">
                <button onClick={() => openEdit(acc)} className="text-wt-text-muted hover:text-wt-text-primary"><Pencil className="w-4 h-4" /></button>
                <AlertDialog>
                  <AlertDialogTrigger asChild><button className="text-wt-text-muted hover:text-red-400"><Trash2 className="w-4 h-4" /></button></AlertDialogTrigger>
                  <AlertDialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                    <AlertDialogHeader>
                      <AlertDialogTitle style={{ color: '#F0F4F8' }}>Excluir conta?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(acc.id)} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
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
