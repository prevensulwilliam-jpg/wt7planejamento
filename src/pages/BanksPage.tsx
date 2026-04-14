import { useState } from "react";
import { Plus, Pencil, Trash2, Landmark, Copy, Check } from "lucide-react";
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
  { value: "corrente",     label: "Conta Corrente"  },
  { value: "poupanca",     label: "Poupança"         },
  { value: "investimento", label: "Investimento"     },
  { value: "digital",      label: "Carteira Digital" },
];

const typeBadgeVariant: Record<string, 'gold' | 'green' | 'cyan' | 'gray'> = {
  corrente: 'cyan', poupanca: 'green', investimento: 'gold', digital: 'gray',
};

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
      style={{
        background: copied ? 'rgba(16,185,129,0.12)' : 'rgba(201,168,76,0.08)',
        border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(201,168,76,0.2)'}`,
        color: copied ? '#10B981' : '#C9A84C',
      }}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copiado!' : label}
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
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
    bank_code: "", agency: "", account_number: "", pix_key: "",
  });

  const totalBalance = data.reduce((s, a) => s + (a.balance ?? 0), 0);

  const closeDialog = () => {
    setDialogOpen(false);
    setEditId(null);
    setForm({ bank_name: "", account_type: "corrente", balance: "", last_updated: "", notes: "", bank_code: "", agency: "", account_number: "", pix_key: "" });
  };

  const handleSubmit = async () => {
    if (!form.bank_name) return;
    const payload: any = {
      bank_name:      form.bank_name,
      account_type:   form.account_type,
      balance:        parseFloat(form.balance) || 0,
      last_updated:   form.last_updated || null,
      notes:          form.notes || null,
      bank_code:      form.bank_code || null,
      agency:         form.agency || null,
      account_number: form.account_number || null,
      pix_key:        form.pix_key || null,
    };
    try {
      if (editId) {
        await updateAccount.mutateAsync({ id: editId, ...payload });
        toast({ title: "Conta atualizada" });
      } else {
        await createAccount.mutateAsync(payload);
        toast({ title: "Conta adicionada" });
      }
      closeDialog();
    } catch {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const openEdit = (acc: any) => {
    setEditId(acc.id);
    setForm({
      bank_name:      acc.bank_name,
      account_type:   acc.account_type ?? "corrente",
      balance:        String(acc.balance ?? 0),
      last_updated:   acc.last_updated ?? "",
      notes:          acc.notes ?? "",
      bank_code:      acc.bank_code ?? "",
      agency:         acc.agency ?? "",
      account_number: acc.account_number ?? "",
      pix_key:        acc.pix_key ?? "",
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

        <Dialog open={dialogOpen} onOpenChange={o => { if (!o) closeDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <GoldButton><Plus className="w-4 h-4" />Adicionar Conta</GoldButton>
          </DialogTrigger>
          <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
            <DialogHeader>
              <DialogTitle style={{ color: '#F0F4F8' }}>{editId ? "Editar Conta" : "Nova Conta"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
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
              {/* Dados bancários opcionais */}
              <div className="pt-1" style={{ borderTop: '1px solid #1A2535' }}>
                <p className="text-xs mb-2" style={{ color: '#64748B' }}>Dados bancários (opcional)</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label style={{ color: '#94A3B8' }}>Banco (cód.)</Label>
                    <Input value={form.bank_code} onChange={e => setForm(f => ({ ...f, bank_code: e.target.value }))} placeholder="ex: 085" style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }} />
                  </div>
                  <div>
                    <Label style={{ color: '#94A3B8' }}>Agência</Label>
                    <Input value={form.agency} onChange={e => setForm(f => ({ ...f, agency: e.target.value }))} placeholder="ex: 2982-3" style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }} />
                  </div>
                  <div>
                    <Label style={{ color: '#94A3B8' }}>C/c</Label>
                    <Input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} placeholder="ex: 57179-2" style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }} />
                  </div>
                </div>
                <div className="mt-2">
                  <Label style={{ color: '#94A3B8' }}>Chave Pix</Label>
                  <Input value={form.pix_key} onChange={e => setForm(f => ({ ...f, pix_key: e.target.value }))} placeholder="CPF, e-mail, telefone ou chave aleatória" style={{ background: '#080C10', borderColor: '#1A2535', color: '#F0F4F8' }} />
                </div>
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

              <p className="text-xs font-mono mb-3" style={{ color: '#4A5568' }}>
                Atualizado: {acc.last_updated ? formatDate(acc.last_updated) : '—'}
              </p>

              {/* Dados bancários com botões copiar */}
              {(acc.agency || acc.account_number || acc.pix_key) && (
                <div className="mb-3 rounded-lg px-3 py-2 space-y-2" style={{ background: '#080C10', border: '1px solid #1A2535' }}>
                  {/* Linha de informações */}
                  <div className="space-y-0.5">
                    {acc.bank_code     && <p className="text-xs" style={{ color: '#94A3B8' }}><span style={{ color: '#64748B' }}>Banco: </span>{acc.bank_code}</p>}
                    {acc.agency        && <p className="text-xs" style={{ color: '#94A3B8' }}><span style={{ color: '#64748B' }}>Agência: </span>{acc.agency}</p>}
                    {acc.account_number && <p className="text-xs" style={{ color: '#94A3B8' }}><span style={{ color: '#64748B' }}>C/c: </span>{acc.account_number}</p>}
                    {acc.pix_key       && <p className="text-xs" style={{ color: '#94A3B8' }}><span style={{ color: '#64748B' }}>Pix: </span>{acc.pix_key}</p>}
                  </div>
                  {/* Botões de cópia */}
                  <div className="flex gap-2 flex-wrap">
                    {(acc.bank_code || acc.agency || acc.account_number) && (
                      <CopyBtn
                        label="Copiar dados"
                        text={[
                          acc.bank_code      ? `Banco: ${acc.bank_code}`       : '',
                          acc.agency         ? `Agência: ${acc.agency}`        : '',
                          acc.account_number ? `C/c: ${acc.account_number}`    : '',
                        ].filter(Boolean).join(' | ')}
                      />
                    )}
                    {acc.pix_key && <CopyBtn label="Copiar Pix" text={acc.pix_key} />}
                  </div>
                </div>
              )}

              {acc.notes && <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>{acc.notes}</p>}

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
