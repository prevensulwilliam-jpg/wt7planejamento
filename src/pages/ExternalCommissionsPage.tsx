import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { MonthPicker } from "@/components/wt7/MonthPicker";
import { GoldButton } from "@/components/wt7/GoldButton";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useOtherCommissions, useOtherCommissionsSummary, useCreateOtherCommission, useDeleteOtherCommission } from "@/hooks/useOtherCommissions";
import { formatCurrency, formatMonth, getCurrentMonth } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

const sourceOptions = [
  { value: "Brava Comex", label: "Brava Comex" },
  { value: "Solar Q7", label: "Solar Q7" },
  { value: "Olga", label: "Projeto Olga" },
  { value: "Imobiliário", label: "Imobiliário" },
  { value: "Consultoria", label: "Consultoria" },
  { value: "Outro", label: "Outro" },
];

export default function ExternalCommissionsPage() {
  const [month, setMonth] = useState(getCurrentMonth());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl" style={{ color: '#F0F4F8' }}>
          Comissões Externas
        </h1>
        <MonthPicker value={month} onChange={v => setMonth(v)} className="w-44" />
      </div>
      <p className="text-sm" style={{ color: '#94A3B8' }}>
        Comissões de negociações fora da Prevensul — Brava Comex, Solar, Imobiliário, Consultoria, etc.
      </p>
      <KPIs month={month} />
      <FormSection month={month} />
      <HistorySection month={month} />
    </div>
  );
}

function KPIs({ month }: { month: string }) {
  const { totalAmount, totalCommission, totalRecords, isLoading } = useOtherCommissionsSummary(month);
  if (isLoading) return <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <KpiCard label="Total Movimentado" value={totalAmount} color="cyan" compact />
      <KpiCard label="Comissões Geradas" value={totalCommission} color="gold" compact />
      <KpiCard label="Registros" value={totalRecords} color="cyan" compact />
    </div>
  );
}

function FormSection({ month }: { month: string }) {
  const { toast } = useToast();
  const createMut = useCreateOtherCommission();
  const [form, setForm] = useState({
    description: "", source: "", amount: "", commission_rate: "3", notes: "",
  });

  const amount = parseFloat(form.amount) || 0;
  const rate = (parseFloat(form.commission_rate) || 0) / 100;
  const commissionValue = amount * rate;

  const handleSubmit = async () => {
    if (!form.description || !form.amount) {
      toast({ title: "Preencha descrição e valor", variant: "destructive" }); return;
    }
    try {
      const { data: { user } } = await (await import("@/integrations/supabase/client")).supabase.auth.getUser();
      await createMut.mutateAsync({
        description: form.description,
        source: form.source || null,
        reference_month: month,
        amount,
        commission_rate: rate,
        commission_value: commissionValue,
        notes: form.notes || null,
        created_by: user?.id ?? null,
      });
      toast({ title: "Comissão registrada!" });
      setForm({ description: "", source: "", amount: "", commission_rate: "3", notes: "" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const inputStyle = { background: '#0D1318', border: '1px solid #1A2535', color: '#F0F4F8' };

  return (
    <PremiumCard>
      <h2 className="font-display font-semibold text-lg mb-4" style={{ color: '#F0F4F8' }}>Registrar Comissão</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Descrição *</label>
          <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={inputStyle} placeholder="Ex: Comissão venda solar residencial" />
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Origem</label>
          <Select value={form.source} onValueChange={v => setForm(p => ({ ...p, source: v }))}>
            <SelectTrigger style={inputStyle}><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>{sourceOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Valor (R$) *</label>
          <Input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} style={inputStyle} placeholder="0,00" />
        </div>
        <div>
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Taxa comissão (%)</label>
          <Input type="number" value={form.commission_rate} onChange={e => setForm(p => ({ ...p, commission_rate: e.target.value }))} style={inputStyle} />
        </div>
        <div className="lg:col-span-1">
          <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Observações</label>
          <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={inputStyle} rows={2} />
        </div>
      </div>
      <div className="mt-4 rounded-xl p-4 flex items-center justify-between" style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)' }}>
        <span className="font-mono text-sm" style={{ color: '#E8C97A' }}>Comissão ({form.commission_rate}%)</span>
        <span className="font-mono text-xl font-bold" style={{ color: '#C9A84C' }}>{formatCurrency(commissionValue)}</span>
      </div>
      <div className="mt-4 flex justify-end">
        <GoldButton onClick={handleSubmit} disabled={createMut.isPending}>
          {createMut.isPending ? "Salvando..." : "Registrar Comissão"}
        </GoldButton>
      </div>
    </PremiumCard>
  );
}

function HistorySection({ month }: { month: string }) {
  const { data = [], isLoading } = useOtherCommissions(month);
  const deleteMut = useDeleteOtherCommission();
  const { toast } = useToast();

  if (isLoading) return <Skeleton className="h-48 rounded-2xl" />;
  if (data.length === 0) return (
    <PremiumCard><p className="text-center py-8 font-mono text-sm" style={{ color: '#4A5568' }}>Nenhuma comissão externa em {formatMonth(month)}</p></PremiumCard>
  );

  const total = data.reduce((s, r) => s + (r.commission_value ?? 0), 0);

  return (
    <PremiumCard>
      <h2 className="font-display font-semibold text-lg mb-4" style={{ color: '#F0F4F8' }}>Histórico — {formatMonth(month)}</h2>
      <div className="overflow-auto rounded-xl" style={{ border: '1px solid #1A2535' }}>
        <Table>
          <TableHeader>
            <TableRow style={{ borderColor: '#1A2535' }}>
              <TableHead style={{ color: '#94A3B8' }}>Descrição</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Origem</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Valor</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Taxa</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Comissão</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Obs</TableHead>
              <TableHead style={{ color: '#94A3B8' }}>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map(r => (
              <TableRow key={r.id} style={{ borderColor: '#1A2535' }}>
                <TableCell style={{ color: '#F0F4F8' }}>{r.description}</TableCell>
                <TableCell style={{ color: '#94A3B8' }}>{r.source || "—"}</TableCell>
                <TableCell className="font-mono" style={{ color: '#94A3B8' }}>{formatCurrency(r.amount)}</TableCell>
                <TableCell className="font-mono" style={{ color: '#94A3B8' }}>{((r.commission_rate ?? 0) * 100).toFixed(1)}%</TableCell>
                <TableCell className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(r.commission_value)}</TableCell>
                <TableCell className="text-xs max-w-[150px] truncate" style={{ color: '#64748B' }}>{r.notes || "—"}</TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"><Trash2 className="w-4 h-4" style={{ color: '#F43F5E' }} /></button>
                    </AlertDialogTrigger>
                    <AlertDialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                      <AlertDialogHeader>
                        <AlertDialogTitle style={{ color: '#F0F4F8' }}>Excluir comissão?</AlertDialogTitle>
                        <AlertDialogDescription style={{ color: '#94A3B8' }}>"{r.description}" será removida permanentemente.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel style={{ background: '#1A2535', color: '#F0F4F8', border: 'none' }}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={async () => { try { await deleteMut.mutateAsync(r.id); toast({ title: "Excluído" }); } catch (e: any) { toast({ title: "Erro", description: e.message, variant: "destructive" }); } }} style={{ background: '#F43F5E', color: '#fff' }}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3 text-right">
        <span className="text-xs uppercase tracking-wider" style={{ color: '#64748B' }}>Total comissões: </span>
        <span className="font-mono font-bold text-lg" style={{ color: '#E8C97A' }}>{formatCurrency(total)}</span>
      </div>
    </PremiumCard>
  );
}
