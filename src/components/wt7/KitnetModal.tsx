import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { MonthPicker } from "@/components/wt7/MonthPicker";
import { DatePicker } from "@/components/wt7/DatePicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GoldButton } from "@/components/wt7/GoldButton";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  useUpdateKitnet,
  useKitnetFechamentos,
  useCreateKitnetEntry,
  useUpdateKitnetEntry,
  useDeleteKitnetEntry,
  useLastEnergyReading,
  useCelescInvoices,
  useLockedMonth,
  useKitnetMonthStatus,
  useUpsertKitnetMonthStatus,
  useKitnetEffectiveData,
  useUpsertKitnetMonthData,
  useKitnetAlerts,
  useCreateKitnetAlert,
  useResolveKitnetAlert,
} from "@/hooks/useKitnets";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatMonth, getCurrentMonth } from "@/lib/formatters";
import { DEFAULT_ENERGY_TARIFF } from "@/lib/constants";
import { Upload, FileText, Trash2, Plus, Zap, Printer, Pencil, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { abrirReciboIndividual } from "@/lib/relatorioFechamento";
import type { Tables } from "@/integrations/supabase/types";

const statusLabels: Record<string, { label: string; variant: "green" | "gold" | "red" }> = {
  occupied: { label: "Ocupada", variant: "green" },
  maintenance: { label: "Manutenção", variant: "gold" },
  vacant: { label: "Vaga", variant: "red" },
};

interface Props {
  kitnet: Tables<"kitnets">;
  onClose: () => void;
  onUpdated: () => void;
  defaultMonth?: string;
  disableLock?: boolean;
}

export function KitnetModal({ kitnet, onClose, onUpdated, defaultMonth, disableLock = false }: Props) {
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <span className="font-mono">{kitnet.code}</span>
            <WtBadge variant={statusLabels[kitnet.status ?? "vacant"]?.variant ?? "red"}>
              {statusLabels[kitnet.status ?? "vacant"]?.label ?? "Vaga"}
            </WtBadge>
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="dados">
          <TabsList className="bg-background border border-border w-full">
            <TabsTrigger value="dados" className="flex-1">Dados</TabsTrigger>
            <TabsTrigger value="contrato" className="flex-1">Contrato</TabsTrigger>
            <TabsTrigger value="fechamentos" className="flex-1">Fechamentos</TabsTrigger>
          </TabsList>
          <TabsContent value="dados"><DadosTab kitnet={kitnet} onUpdated={onUpdated} defaultMonth={defaultMonth} /></TabsContent>
          <TabsContent value="contrato"><ContratoTab kitnet={kitnet} onUpdated={onUpdated} /></TabsContent>
          <TabsContent value="fechamentos"><FechamentosTab kitnet={kitnet} defaultMonth={defaultMonth} disableLock={disableLock} /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── ABA DADOS ───
function DadosTab({ kitnet, onUpdated, defaultMonth }: { kitnet: Tables<"kitnets">; onUpdated: () => void; defaultMonth?: string }) {
  const { toast } = useToast();
  const upsertMonthData   = useUpsertKitnetMonthData();
  const upsertMonthStatus = useUpsertKitnetMonthStatus();
  const updateMut         = useUpdateKitnet(); // só usado sem contexto de mês

  // Dados efetivos do mês (snapshot mais recente ≤ defaultMonth)
  const { data: effectiveData } = useKitnetEffectiveData(kitnet.id, defaultMonth ?? "");
  // Status efetivo do mês
  const { data: monthStatusData } = useKitnetMonthStatus(kitnet.id, defaultMonth ?? "");

  const [form, setForm] = useState({
    tenant_name:  kitnet.tenant_name  ?? "",
    tenant_phone: kitnet.tenant_phone ?? "",
    rent_value:   String(kitnet.rent_value ?? ""),
    status:       kitnet.status ?? "vacant",
  });

  // Quando os dados do mês carregam, preenche o form com os valores efetivos
  useEffect(() => {
    setForm(f => ({
      ...f,
      tenant_name:  effectiveData?.tenant_name  ?? kitnet.tenant_name  ?? "",
      tenant_phone: effectiveData?.tenant_phone ?? kitnet.tenant_phone ?? "",
      rent_value:   String(effectiveData?.rent_value ?? kitnet.rent_value ?? ""),
    }));
  }, [effectiveData]);

  useEffect(() => {
    setForm(f => ({ ...f, status: monthStatusData?.status ?? kitnet.status ?? "vacant" }));
  }, [monthStatusData, kitnet.status]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    try {
      if (defaultMonth) {
        // Salva dados por mês (não altera kitnets globalmente)
        await upsertMonthData.mutateAsync({
          kitnetId:     kitnet.id,
          month:        defaultMonth,
          tenant_name:  form.tenant_name  || null,
          tenant_phone: form.tenant_phone || null,
          rent_value:   Number(form.rent_value) || null,
        });
        await upsertMonthStatus.mutateAsync({
          kitnetId: kitnet.id,
          month:    defaultMonth,
          status:   form.status,
        });
      } else {
        // Sem contexto de mês: atualiza global (cadastro inicial)
        await updateMut.mutateAsync({
          id:           kitnet.id,
          tenant_name:  form.tenant_name  || null,
          tenant_phone: form.tenant_phone || null,
          rent_value:   Number(form.rent_value) || null,
          status:       form.status,
        });
      }
      toast({ title: "Dados salvos!" });
      onUpdated();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const isSaving = upsertMonthData.isPending || upsertMonthStatus.isPending || updateMut.isPending;

  return (
    <div className="space-y-4 mt-4">
      {defaultMonth && (
        <p className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(99,102,241,0.08)', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.2)' }}>
          Editando dados de <strong>{defaultMonth.slice(5, 7)}/{defaultMonth.slice(0, 4)}</strong> — não afeta outros meses
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Nome do Inquilino</label>
          <Input value={form.tenant_name} onChange={e => set("tenant_name", e.target.value)} placeholder="Nome completo" className="bg-background border-border text-foreground" />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Telefone</label>
          <Input value={form.tenant_phone} onChange={e => set("tenant_phone", e.target.value)} placeholder="(47) 9xxxx-xxxx" className="bg-background border-border text-foreground" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor Aluguel (R$)</label>
          <Input type="number" value={form.rent_value} onChange={e => set("rent_value", e.target.value)} className="bg-background border-border text-foreground" />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {defaultMonth ? `Status — ${defaultMonth.slice(5, 7)}/${defaultMonth.slice(0, 4)}` : "Status"}
          </label>
          <Select value={form.status} onValueChange={v => set("status", v)}>
            <SelectTrigger className="bg-background border-border text-foreground"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="occupied">Ocupada</SelectItem>
              <SelectItem value="vacant">Vaga</SelectItem>
              <SelectItem value="maintenance">Manutenção</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {(kitnet.deposit_bank || kitnet.deposit_agency || kitnet.deposit_account) && (
        <div className="rounded-lg p-3 bg-secondary/30">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Dados Bancários</p>
          <p className="text-sm text-foreground font-mono">
            {kitnet.deposit_bank} | Ag: {kitnet.deposit_agency} | CC: {kitnet.deposit_account}
          </p>
        </div>
      )}
      <GoldButton onClick={handleSave} disabled={isSaving} className="w-full justify-center">
        {isSaving ? "Salvando..." : "Salvar Dados"}
      </GoldButton>
    </div>
  );
}

// ─── ABA CONTRATO ───
function ContratoTab({ kitnet, onUpdated }: { kitnet: Tables<"kitnets">; onUpdated: () => void }) {
  const { toast } = useToast();
  const updateMut = useUpdateKitnet();
  const [uploading, setUploading] = useState(false);
  const [contractUrl, setContractUrl] = useState(kitnet.contract_url ?? "");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".pdf")) {
      toast({ title: "Apenas PDF", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const path = `${kitnet.residencial_code}/${kitnet.code}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from("contracts").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("contracts").getPublicUrl(path);
      await updateMut.mutateAsync({ id: kitnet.id, contract_url: publicUrl });
      setContractUrl(publicUrl);
      toast({ title: "Contrato enviado!" });
      onUpdated();
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    try {
      await updateMut.mutateAsync({ id: kitnet.id, contract_url: null });
      setContractUrl("");
      toast({ title: "Contrato removido" });
      onUpdated();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 mt-4">
      {contractUrl ? (
        <PremiumCard className="p-4 flex items-center gap-3">
          <FileText className="w-8 h-8 text-[#E8C97A] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground font-medium">Contrato vigente</p>
            <a href={contractUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#E8C97A] hover:underline truncate block">
              Ver contrato
            </a>
          </div>
          <div className="flex gap-2">
            <label className="cursor-pointer">
              <input type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
              <span className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 transition-colors">Trocar</span>
            </label>
            <button onClick={handleRemove} className="text-xs text-red-400 hover:text-red-300 border border-border rounded px-2 py-1 transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </PremiumCard>
      ) : (
        <label className="cursor-pointer block">
          <input type="file" accept=".pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
          <PremiumCard className="p-8 text-center border-dashed hover:border-[#E8C97A]/50 transition-colors">
            {uploading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-8 rounded-full mx-auto" />
                <p className="text-sm text-muted-foreground">Enviando...</p>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-foreground font-medium">Fazer upload do contrato</p>
                <p className="text-xs text-muted-foreground mt-1">Apenas PDF</p>
              </>
            )}
          </PremiumCard>
        </label>
      )}
    </div>
  );
}

// ─── ABA FECHAMENTOS ───
function FechamentosTab({ kitnet, defaultMonth, disableLock = false }: { kitnet: Tables<"kitnets">; defaultMonth?: string; disableLock?: boolean }) {
  const { toast } = useToast();
  const { data: fechamentos, isLoading } = useKitnetFechamentos(kitnet.id);
  const deleteEntry = useDeleteKitnetEntry();
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  // Inicializa com o mês da tela principal se disponível
  const [selectedMonth, setSelectedMonth] = useState<string | null>(defaultMonth ?? null);

  // Determina o mês a exibir: selectedMonth ou o mais recente
  const latestMonth = fechamentos?.length
    ? [...fechamentos].sort((a: any, b: any) =>
        (b.reference_month ?? "").localeCompare(a.reference_month ?? "")
      )[0]?.reference_month ?? null
    : null;

  const displayMonth = selectedMonth ?? latestMonth;

  const displayed = fechamentos?.find((f: any) => f.reference_month === displayMonth) ?? null;

  // ── Verificação do cadeado para o mês exibido (ignorado no Portal Manager) ──
  const { data: lockData } = useLockedMonth(disableLock ? "" : (displayMonth ?? ""));
  const isMonthLocked = !disableLock && !!(lockData as any)?.is_locked;

  // ── Alertas de saldo pendente no mês exibido ──
  const { data: pendingAlerts } = useKitnetAlerts(kitnet.id, displayMonth ?? "");
  const resolveAlert = useResolveKitnetAlert();

  // Saldo pré-preenchido para o novo fechamento (quando usuário clica "Incluir como acréscimo")
  const [prefilledSurcharge, setPrefilledSurcharge] = useState<{ amount: number; sourceMonth: string; alertId: string } | null>(null);

  const handleEdit = (entry: any) => {
    setShowForm(false);
    setEditingEntry(entry);
  };

  const handleCancelEdit = () => setEditingEntry(null);

  const handleNewFechamento = () => {
    setEditingEntry(null);
    if (!showForm) setSelectedMonth(defaultMonth ?? getCurrentMonth());
    setShowForm(v => !v);
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Banner de mês fechado */}
      {isMonthLocked && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium"
          style={{ background: 'rgba(247,201,72,0.1)', border: '1px solid rgba(247,201,72,0.35)', color: '#F7C948' }}>
          <Lock className="w-3.5 h-3.5 flex-shrink-0" />
          Mês fechado — edições bloqueadas
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        {/* Seletor de mês — oculto quando form de novo fechamento está aberto */}
        <div className="flex items-center gap-2">
          {!showForm && (
            <>
              <MonthPicker
                value={displayMonth ?? getCurrentMonth()}
                onChange={v => setSelectedMonth(v)}
                className="w-40"
              />
              {selectedMonth && selectedMonth !== latestMonth && (
                <button
                  onClick={() => setSelectedMonth(null)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Último
                </button>
              )}
            </>
          )}
        </div>
        <GoldButton onClick={handleNewFechamento}>
          <Plus className="w-4 h-4 mr-1" />
          {showForm ? "Cancelar" : "Novo Fechamento"}
        </GoldButton>
      </div>

      {/* Banner de saldo pendente — aparece quando há alertas não resolvidos no mês */}
      {(pendingAlerts ?? []).length > 0 && !showForm && !editingEntry && (
        <div className="space-y-2">
          {(pendingAlerts ?? []).map((alert: any) => (
            <div key={alert.id} className="flex items-start justify-between gap-3 rounded-lg px-3 py-2.5"
              style={{ background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <div>
                <p className="text-xs font-semibold" style={{ color: '#F59E0B' }}>
                  ⚠ Saldo pendente de {formatMonth(alert.source_month)}: {formatCurrency(alert.pending_amount)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Clique para incluir como acréscimo no novo fechamento</p>
              </div>
              <button
                onClick={() => {
                  setPrefilledSurcharge({ amount: alert.pending_amount, sourceMonth: alert.source_month, alertId: alert.id });
                  setEditingEntry(null);
                  setShowForm(true);
                }}
                className="text-xs px-3 py-1.5 rounded-lg font-medium whitespace-nowrap flex-shrink-0"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.35)' }}
              >
                + Incluir acréscimo
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <FechamentoForm
          kitnet={kitnet}
          onSaved={(savedMonth) => {
            setShowForm(false);
            setPrefilledSurcharge(null);
            if (savedMonth) setSelectedMonth(savedMonth);
          }}
          defaultMonth={defaultMonth ?? getCurrentMonth()}
          pendingSurcharge={prefilledSurcharge ?? undefined}
          onAlertResolved={(alertId) => resolveAlert.mutateAsync(alertId)}
        />
      )}
      {editingEntry && (
        <FechamentoForm
          kitnet={kitnet}
          onSaved={() => setEditingEntry(null)}
          onCancel={handleCancelEdit}
          initialData={editingEntry}
          entryId={editingEntry.id}
        />
      )}

      {isLoading ? (
        <Skeleton className="h-24 rounded-xl" />
      ) : !fechamentos?.length ? (
        <PremiumCard className="text-center py-8">
          <p className="text-muted-foreground text-sm">Nenhum fechamento registrado</p>
        </PremiumCard>
      ) : displayed ? (
        <PremiumCard className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">{formatMonth(displayed.reference_month ?? "")}</p>
            <div className="flex items-center gap-2">
              {selectedMonth === null && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs px-2 py-0.5 rounded-full cursor-default" style={{ background: 'rgba(232,201,122,0.15)', color: '#E8C97A' }}>
                        Último fechamento
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Lançado em {displayed.created_at ? new Date(displayed.created_at).toLocaleDateString("pt-BR") + " às " + new Date(displayed.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "data desconhecida"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <button
                onClick={async () => {
                  if (isMonthLocked) { toast({ title: "🔒 Mês fechado", description: "Desbloqueie o mês para apagar fechamentos." }); return; }
                  if (!window.confirm("Deseja realmente apagar este fechamento?")) return;
                  try {
                    await deleteEntry.mutateAsync(displayed.id);
                    toast({ title: "Fechamento apagado com sucesso" });
                  } catch {
                    toast({ title: "Erro ao apagar fechamento", variant: "destructive" });
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={isMonthLocked
                  ? { background: 'rgba(239,68,68,0.05)', color: '#9CA3AF', border: '1px solid rgba(100,100,100,0.2)', cursor: 'not-allowed', opacity: 0.5 }
                  : { background: 'rgba(239,68,68,0.12)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}
                title={isMonthLocked ? "Mês fechado" : "Apagar fechamento"}
              >
                <Trash2 className="w-3.5 h-3.5" /> Apagar
              </button>
              <button
                onClick={() => { if (isMonthLocked) { toast({ title: "🔒 Mês fechado", description: "Desbloqueie o mês para editar fechamentos." }); return; } handleEdit(displayed); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={isMonthLocked
                  ? { background: 'rgba(99,102,241,0.05)', color: '#9CA3AF', border: '1px solid rgba(100,100,100,0.2)', cursor: 'not-allowed', opacity: 0.5 }
                  : { background: 'rgba(99,102,241,0.12)', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.3)' }}
                title={isMonthLocked ? "Mês fechado" : "Editar fechamento"}
              >
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
              <button
                onClick={() => abrirReciboIndividual(kitnet, displayed)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: 'rgba(232,201,122,0.12)', color: '#E8C97A', border: '1px solid rgba(232,201,122,0.3)' }}
                title="Gerar recibo de repasse"
              >
                <Printer className="w-3.5 h-3.5" /> Gerar Recibo
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>Aluguel bruto: <span className="text-foreground font-mono">{formatCurrency((displayed as any).rent_gross ?? 0)}</span></span>
            <span>ADM: <span className="text-foreground font-mono">{formatCurrency((displayed as any).adm_fee ?? 0)}</span></span>
            {(displayed as any).celesc > 0 && <span>CELESC: <span className="text-foreground font-mono">{formatCurrency((displayed as any).celesc)}</span></span>}
            {(displayed as any).semasa > 0 && <span>SEMASA: <span className="text-foreground font-mono">{formatCurrency((displayed as any).semasa)}</span></span>}
            {(displayed as any).iptu_taxa > 0 && <span>IPTU/Lixo: <span className="text-foreground font-mono">{formatCurrency((displayed as any).iptu_taxa)}</span></span>}
          </div>
          {/* Desconto */}
          {(displayed as any).discount_amount > 0 && (
            <div className="rounded-md px-3 py-2 text-xs" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <span style={{ color: '#F59E0B' }}>↓ Desconto: </span>
              <span className="font-mono font-medium" style={{ color: '#F59E0B' }}>− {formatCurrency((displayed as any).discount_amount)}</span>
              {(displayed as any).discount_reason && <span className="text-muted-foreground ml-2">— {(displayed as any).discount_reason}</span>}
            </div>
          )}
          {/* Acréscimo */}
          {(displayed as any).surcharge_amount > 0 && (
            <div className="rounded-md px-3 py-2 text-xs" style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)' }}>
              <span style={{ color: '#F43F5E' }}>↑ Acréscimo: </span>
              <span className="font-mono font-medium" style={{ color: '#F43F5E' }}>+ {formatCurrency((displayed as any).surcharge_amount)}</span>
              {(displayed as any).surcharge_reason && <span className="text-muted-foreground ml-2">— {(displayed as any).surcharge_reason}</span>}
            </div>
          )}
          {/* Observação */}
          {(displayed as any).notes && (
            <div className="rounded-md px-3 py-2 text-xs" style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.2)' }}>
              <span style={{ color: '#60A5FA' }}>✎ </span>
              <span className="text-muted-foreground">{(displayed as any).notes}</span>
            </div>
          )}
          <div className="pt-2 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Líquido</p>
            <p className="font-mono font-bold text-2xl" style={{ color: '#E8C97A' }}>{formatCurrency((displayed as any).total_liquid ?? 0)}</p>
          </div>
        </PremiumCard>
      ) : (
        <PremiumCard className="text-center py-8">
          <p className="text-muted-foreground text-sm">Nenhum fechamento em {formatMonth(displayMonth ?? "")}</p>
        </PremiumCard>
      )}
    </div>
  );
}

// ─── FORM NOVO / EDITAR FECHAMENTO ───
interface FechamentoFormProps {
  kitnet: Tables<"kitnets">;
  onSaved: (savedMonth?: string) => void;
  onCancel?: () => void;
  initialData?: any;
  entryId?: string;
  defaultMonth?: string;
  pendingSurcharge?: { amount: number; sourceMonth: string; alertId: string };
  onAlertResolved?: (alertId: string) => Promise<void>;
}

// Helper: adiciona N meses a uma string YYYY-MM
function addMonths(monthStr: string, n: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function FechamentoForm({ kitnet, onSaved, onCancel, initialData, entryId, defaultMonth, pendingSurcharge, onAlertResolved }: FechamentoFormProps) {
  const isEditMode = !!entryId;
  const { toast } = useToast();
  const createMut = useCreateKitnetEntry();
  const updateMut = useUpdateKitnetEntry();
  const createAlert = useCreateKitnetAlert();
  const [month] = useState(defaultMonth ?? getCurrentMonth());
  const { data: lastReading } = useLastEnergyReading(kitnet.id);
  const { data: invoices } = useCelescInvoices(month);
  // Usa rent_value efetivo do mês (snapshot) para pré-preencher aluguel bruto
  const { data: effectiveData } = useKitnetEffectiveData(kitnet.id, month);
  const effectiveRentValue = effectiveData?.rent_value ?? kitnet.rent_value ?? 0;

  const [form, setForm] = useState({
    period_start: initialData?.period_start ?? "",
    period_end: initialData?.period_end ?? "",
    rent_gross: String(initialData?.rent_gross ?? kitnet.rent_value ?? 0),
    iptu_taxa: String(initialData?.iptu_taxa ?? 0),
    celesc: String(initialData?.celesc ?? 0),
    semasa: String(initialData?.semasa ?? 0),
    adm_fee: String(initialData?.adm_fee ?? ((kitnet.rent_value ?? 0) * 0.1).toFixed(2)),
    reference_month: initialData?.reference_month ?? (defaultMonth ?? getCurrentMonth()),
    discount_amount: String(initialData?.discount_amount ?? ""),
    discount_reason: initialData?.discount_reason ?? "",
    surcharge_amount: String(pendingSurcharge?.amount ?? initialData?.surcharge_amount ?? ""),
    surcharge_reason: pendingSurcharge
      ? `Saldo mês anterior (${formatMonth(pendingSurcharge.sourceMonth)})`
      : (initialData?.surcharge_reason ?? ""),
    notes: initialData?.notes ?? "",
  });

  const [discountOpen, setDiscountOpen] = useState(!!(initialData?.discount_amount));
  const [surchargeOpen, setSurchargeOpen] = useState(!!(initialData?.surcharge_amount) || !!(pendingSurcharge));
  const [notesOpen, setNotesOpen] = useState(!!(initialData?.notes));
  const [isParcial, setIsParcial] = useState(false);
  const [valorPago, setValorPago] = useState("");
  const [numParcelas, setNumParcelas] = useState("2");
  const [celescMode, setCelescMode] = useState<"idle" | "loading" | "found" | "manual">("idle");
  const [celescFoundInfo, setCelescFoundInfo] = useState<{ kwh: number; amount: number; tariff: number } | null>(null);
  const [readingCurrent, setReadingCurrent] = useState("");

  const tariff = invoices?.find(i => i.residencial_code === kitnet.residencial_code)?.tariff_per_kwh ?? DEFAULT_ENERGY_TARIFF;
  const prevReading = lastReading?.reading_current ?? 0;
  const kwh = Math.max(0, (Number(readingCurrent) || 0) - prevReading);
  const celescCalc = kwh * tariff;

  const handleCelescCalc = async () => {
    setCelescMode("loading");
    try {
      const { data } = await supabase
        .from("energy_readings")
        .select("reading_current, reading_previous, consumption_kwh, amount_to_charge, tariff_per_kwh")
        .eq("kitnet_id", kitnet.id)
        .eq("reference_month", form.reference_month)
        .maybeSingle();

      if (data && data.amount_to_charge != null) {
        setCelescFoundInfo({
          kwh: data.consumption_kwh ?? 0,
          amount: data.amount_to_charge,
          tariff: data.tariff_per_kwh ?? tariff,
        });
        setForm(f => ({ ...f, celesc: data.amount_to_charge!.toFixed(2) }));
        setCelescMode("found");
      } else {
        setCelescMode("manual");
      }
    } catch {
      setCelescMode("manual");
    }
  };

  const applyCelescCalc = () => {
    setForm(f => ({ ...f, celesc: celescCalc.toFixed(2) }));
    setCelescMode("idle");
  };

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const rentGross = Number(form.rent_gross) || 0;
  const iptu = Number(form.iptu_taxa) || 0;
  const celesc = Number(form.celesc) || 0;
  const semasa = Number(form.semasa) || 0;
  const adm = Number(form.adm_fee) || 0;
  const discount = Number(form.discount_amount) || 0;
  const surcharge = Number(form.surcharge_amount) || 0;
  const totalLiquid = rentGross + iptu + celesc + semasa - adm - discount + surcharge;

  // Pagamento parcial
  const valorPagoNum = isParcial ? (Number(valorPago) || 0) : totalLiquid;
  const saldoRestante = isParcial ? Math.max(0, totalLiquid - valorPagoNum) : 0;
  const numParcelasNum = Math.max(1, Number(numParcelas) || 1);
  const parcelaValue = isParcial && saldoRestante > 0 ? Math.round((saldoRestante / numParcelasNum) * 100) / 100 : 0;
  const actualTotalLiquid = isParcial ? valorPagoNum : totalLiquid;

  // Quando rent_value efetivo do mês carrega, pré-preenche rent_gross (só novo fechamento)
  useEffect(() => {
    if (!isEditMode && effectiveRentValue > 0) {
      setForm(f => ({
        ...f,
        rent_gross: String(effectiveRentValue),
        adm_fee: (effectiveRentValue * 0.1).toFixed(2),
      }));
    }
  }, [effectiveRentValue]);

  useEffect(() => {
    setForm(f => ({ ...f, adm_fee: (rentGross * 0.1).toFixed(2) }));
  }, [rentGross]);

  const handleSave = async () => {
    try {
      const extraFields = {
        discount_amount: discount > 0 ? discount : null,
        discount_reason: form.discount_reason || null,
        surcharge_amount: surcharge > 0 ? surcharge : null,
        surcharge_reason: form.surcharge_reason || null,
        notes: form.notes || null,
      };

      if (isEditMode) {
        await updateMut.mutateAsync({
          id: entryId!,
          reference_month: form.reference_month,
          period_start: form.period_start || null,
          period_end: form.period_end || null,
          rent_gross: rentGross,
          iptu_taxa: iptu,
          celesc: celesc,
          semasa: semasa,
          adm_fee: adm,
          total_liquid: actualTotalLiquid,
          ...extraFields,
        } as any);
        toast({ title: "Fechamento atualizado!" });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const newEntryId = await createMut.mutateAsync({
          kitnet_id: kitnet.id,
          _kitnetCode: kitnet.code,
          _tenantName: kitnet.tenant_name ?? undefined,
          reference_month: form.reference_month,
          period_start: form.period_start || null,
          period_end: form.period_end || null,
          rent_gross: rentGross,
          iptu_taxa: iptu,
          celesc: celesc,
          semasa: semasa,
          adm_fee: adm,
          total_liquid: actualTotalLiquid,
          created_by: user?.id,
          ...extraFields,
        } as any);

        // Pagamento parcial → cria N alertas mensais com a parcela
        if (isParcial && saldoRestante > 0 && parcelaValue > 0) {
          for (let i = 1; i <= numParcelasNum; i++) {
            const alertMonth = addMonths(form.reference_month, i);
            const { data: existingAlert } = await (supabase as any)
              .from("kitnet_alerts")
              .select("id")
              .eq("kitnet_id", kitnet.id)
              .eq("alert_month", alertMonth)
              .eq("source_month", form.reference_month)
              .eq("resolved", false)
              .maybeSingle();
            if (!existingAlert) {
              await (supabase as any).from("kitnet_alerts").insert({
                kitnet_id: kitnet.id,
                source_entry_id: newEntryId ?? null,
                alert_month: alertMonth,
                source_month: form.reference_month,
                pending_amount: parcelaValue,
                alert_type: "pending_balance",
                resolved: false,
              });
            }
          }
          const months = Array.from({ length: numParcelasNum }, (_, i) => formatMonth(addMonths(form.reference_month, i + 1))).join(", ");
          toast({ title: "Fechamento salvo!", description: `📅 Saldo de ${formatCurrency(saldoRestante)} dividido em ${numParcelasNum}× de ${formatCurrency(parcelaValue)} → ${months}` });
        } else if (actualTotalLiquid === 0 && effectiveRentValue > 0) {
          // Se total = 0 e há valor esperado → cria alerta para o mês seguinte
          const nextMonthKey = addMonths(form.reference_month, 1);
          const { data: existingAlert } = await (supabase as any)
            .from("kitnet_alerts")
            .select("id")
            .eq("kitnet_id", kitnet.id)
            .eq("alert_month", nextMonthKey)
            .eq("source_month", form.reference_month)
            .eq("resolved", false)
            .maybeSingle();
          if (!existingAlert) {
            await (supabase as any).from("kitnet_alerts").insert({
              kitnet_id: kitnet.id,
              source_entry_id: newEntryId ?? null,
              alert_month: nextMonthKey,
              source_month: form.reference_month,
              pending_amount: effectiveRentValue,
              alert_type: "pending_balance",
              resolved: false,
            });
          }
          toast({ title: "Fechamento salvo!", description: `⚠ Saldo de ${formatCurrency(effectiveRentValue)} registrado para ${formatMonth(nextMonthKey)}.` });
        } else {
          toast({ title: "Fechamento salvo!" });
        }

        // Se havia saldo pendente pré-preenchido → resolve o alerta
        if (pendingSurcharge && surcharge > 0 && onAlertResolved) {
          await onAlertResolved(pendingSurcharge.alertId);
        }
      }
      onSaved(form.reference_month);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <PremiumCard className="p-4 space-y-3 border border-[#E8C97A]/20">
      {pendingSurcharge && (
        <div className="rounded-lg px-3 py-2 text-xs font-medium"
          style={{ background: 'rgba(245,158,11,0.09)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B' }}>
          ⚠ Acréscimo pré-preenchido: {formatCurrency(pendingSurcharge.amount)} de saldo pendente de {formatMonth(pendingSurcharge.sourceMonth)}
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {isEditMode ? "Editar Fechamento" : "Novo Fechamento"}
        </p>
        {onCancel && (
          <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ✕ Cancelar
          </button>
        )}
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mês Referência</label>
        <MonthPicker value={form.reference_month} onChange={v => set("reference_month", v)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Início</label>
          <DatePicker value={form.period_start} onChange={v => set("period_start", v)} />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Fim</label>
          <DatePicker value={form.period_end} onChange={v => set("period_end", v)} />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Aluguel Bruto (R$)</label>
        <Input type="number" value={form.rent_gross} onChange={e => set("rent_gross", e.target.value)} className="bg-background border-border text-foreground" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">IPTU + Taxa Lixo</label>
          <Input type="number" value={form.iptu_taxa} onChange={e => set("iptu_taxa", e.target.value)} className="bg-background border-border text-foreground" />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">SEMASA</label>
          <Input type="number" value={form.semasa} onChange={e => set("semasa", e.target.value)} className="bg-background border-border text-foreground" />
        </div>
      </div>

      {/* CELESC com calculadora */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">CELESC (R$)</label>
          {celescMode === "idle" && (
            <button onClick={handleCelescCalc} className="flex items-center gap-1 text-xs text-[#E8C97A] hover:underline">
              <Zap className="w-3 h-3" /> Calcular pela leitura
            </button>
          )}
          {celescMode === "loading" && (
            <span className="text-xs text-muted-foreground animate-pulse">Buscando leitura...</span>
          )}
          {(celescMode === "found" || celescMode === "manual") && (
            <button onClick={() => setCelescMode("idle")} className="text-xs text-muted-foreground hover:underline">
              ✕ Fechar
            </button>
          )}
        </div>
        <Input type="number" value={form.celesc} onChange={e => set("celesc", e.target.value)} className="bg-background border-border text-foreground" />

        {/* Leitura encontrada automaticamente */}
        {celescMode === "found" && celescFoundInfo && (
          <div className="mt-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 space-y-1">
            <p className="text-xs font-medium" style={{ color: '#4ADE80' }}>✓ Leitura encontrada no sistema</p>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Consumo: <span className="font-mono text-foreground">{celescFoundInfo.kwh.toFixed(2)} kWh</span></span>
              <span>Tarifa: <span className="font-mono text-foreground">R$ {celescFoundInfo.tariff.toFixed(4)}</span></span>
            </div>
            <p className="text-sm font-bold" style={{ color: '#E8C97A' }}>
              {formatCurrency(celescFoundInfo.amount)} aplicado automaticamente
            </p>
          </div>
        )}

        {/* Leitura manual — não encontrada */}
        {celescMode === "manual" && (
          <div className="mt-2 rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">Nenhuma leitura registrada para este mês. Informe abaixo:</p>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Leitura anterior:</span>
              <span className="font-mono">{prevReading.toFixed(2)} kWh</span>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Leitura atual (kWh)</label>
              <Input
                type="number"
                value={readingCurrent}
                onChange={e => setReadingCurrent(e.target.value)}
                placeholder="Digite a leitura atual"
                className="bg-background border-border text-foreground font-mono"
              />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Consumo: <span className="font-mono text-foreground">{kwh.toFixed(2)} kWh</span></span>
              <span className="text-muted-foreground">Tarifa: <span className="font-mono text-foreground">R$ {tariff.toFixed(4)}</span></span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: '#E8C97A' }}>{formatCurrency(celescCalc)}</span>
              <button
                onClick={applyCelescCalc}
                className="text-xs px-3 py-1 rounded bg-[#E8C97A]/20 text-[#E8C97A] hover:bg-[#E8C97A]/30 transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Taxa ADM (10%)</label>
        <Input type="number" value={form.adm_fee} onChange={e => set("adm_fee", e.target.value)} className="bg-background border-border text-foreground" />
      </div>

      {/* ─── Desconto ─── */}
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(245,158,11,0.25)' }}>
        <button
          type="button"
          onClick={() => setDiscountOpen(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors"
          style={{ background: discountOpen ? 'rgba(245,158,11,0.08)' : '#080C10', borderLeft: '3px solid rgba(245,158,11,0.5)' }}
        >
          <span style={{ color: '#F59E0B' }}>↓ Desconto de Aluguel</span>
          <div className="flex items-center gap-2">
            {discount > 0 && <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>− {formatCurrency(discount)}</span>}
            {discountOpen ? <ChevronUp className="w-3.5 h-3.5" style={{ color: '#4A5568' }} /> : <ChevronDown className="w-3.5 h-3.5" style={{ color: '#4A5568' }} />}
          </div>
        </button>
        {discountOpen && (
          <div className="px-3 py-3 space-y-2" style={{ background: '#080C10', borderTop: '1px solid rgba(245,158,11,0.15)' }}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Tipo</label>
                <select
                  value={form.discount_reason.startsWith("Acordo") || form.discount_reason === "" ? form.discount_reason || "" : "__custom"}
                  onChange={e => set("discount_reason", e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 rounded-md text-xs bg-background border-border text-foreground"
                  style={{ border: '1px solid rgba(245,158,11,0.3)' }}
                >
                  <option value="">Selecione...</option>
                  <option value="Acordo com inquilino">Acordo com inquilino</option>
                  <option value="Cortesia">Cortesia</option>
                  <option value="Desconto comercial">Desconto comercial</option>
                  <option value="Manutenção">Manutenção 🔧</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Valor (R$)</label>
                <Input
                  type="number"
                  value={form.discount_amount}
                  onChange={e => set("discount_amount", e.target.value)}
                  placeholder="0,00"
                  className="mt-1 bg-background text-foreground"
                  style={{ borderColor: 'rgba(245,158,11,0.3)' }}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Motivo / Detalhe</label>
              <Input
                value={form.discount_reason}
                onChange={e => set("discount_reason", e.target.value)}
                placeholder="Ex: Pagamento parcial — saldo a cobrar em março"
                className="mt-1 bg-background border-border text-foreground text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* ─── Acréscimo ─── */}
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(244,63,94,0.2)' }}>
        <button
          type="button"
          onClick={() => setSurchargeOpen(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors"
          style={{ background: surchargeOpen ? 'rgba(244,63,94,0.07)' : '#080C10', borderLeft: '3px solid rgba(244,63,94,0.5)' }}
        >
          <span style={{ color: '#F43F5E' }}>↑ Acréscimo de Aluguel</span>
          <div className="flex items-center gap-2">
            {surcharge > 0 && <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(244,63,94,0.1)', color: '#F43F5E' }}>+ {formatCurrency(surcharge)}</span>}
            {surchargeOpen ? <ChevronUp className="w-3.5 h-3.5" style={{ color: '#4A5568' }} /> : <ChevronDown className="w-3.5 h-3.5" style={{ color: '#4A5568' }} />}
          </div>
        </button>
        {surchargeOpen && (
          <div className="px-3 py-3 space-y-2" style={{ background: '#080C10', borderTop: '1px solid rgba(244,63,94,0.15)' }}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Tipo</label>
                <select
                  value={form.surcharge_reason}
                  onChange={e => set("surcharge_reason", e.target.value)}
                  className="w-full mt-1 px-2 py-1.5 rounded-md text-xs bg-background text-foreground"
                  style={{ border: '1px solid rgba(244,63,94,0.3)' }}
                >
                  <option value="">Selecione...</option>
                  <option value="Multa por atraso">Multa por atraso</option>
                  <option value="Juros">Juros</option>
                  <option value="Reparo cobrado ao inquilino">Reparo cobrado ao inquilino</option>
                  <option value="Saldo mês anterior">Saldo mês anterior</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Valor (R$)</label>
                <Input
                  type="number"
                  value={form.surcharge_amount}
                  onChange={e => set("surcharge_amount", e.target.value)}
                  placeholder="0,00"
                  className="mt-1 bg-background text-foreground"
                  style={{ borderColor: 'rgba(244,63,94,0.3)' }}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Motivo / Detalhe</label>
              <Input
                value={form.surcharge_reason}
                onChange={e => set("surcharge_reason", e.target.value)}
                placeholder="Ex: Multa por atraso de 5 dias"
                className="mt-1 bg-background border-border text-foreground text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* ─── Observação ─── */}
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(96,165,250,0.2)' }}>
        <button
          type="button"
          onClick={() => setNotesOpen(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors"
          style={{ background: notesOpen ? 'rgba(96,165,250,0.07)' : '#080C10', borderLeft: '3px solid rgba(96,165,250,0.4)' }}
        >
          <span style={{ color: '#60A5FA' }}>✎ Observação</span>
          <div className="flex items-center gap-2">
            {form.notes && <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(96,165,250,0.1)', color: '#60A5FA' }}>1 nota</span>}
            {notesOpen ? <ChevronUp className="w-3.5 h-3.5" style={{ color: '#4A5568' }} /> : <ChevronDown className="w-3.5 h-3.5" style={{ color: '#4A5568' }} />}
          </div>
        </button>
        {notesOpen && (
          <div className="px-3 py-3" style={{ background: '#080C10', borderTop: '1px solid rgba(96,165,250,0.15)' }}>
            <textarea
              value={form.notes}
              onChange={e => set("notes", e.target.value)}
              placeholder="Ex: Acordo verbal em 03/02 — pagará saldo restante junto com março..."
              rows={3}
              className="w-full px-3 py-2 rounded-md text-xs bg-background text-foreground resize-none"
              style={{ border: '1px solid rgba(96,165,250,0.3)', outline: 'none', fontFamily: 'inherit' }}
            />
          </div>
        )}
      </div>

      {/* ─── Pagamento Parcial ─── */}
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(139,92,246,0.3)' }}>
        <button
          type="button"
          onClick={() => { setIsParcial(v => !v); if (isParcial) { setValorPago(""); setNumParcelas("2"); } }}
          className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium transition-colors"
          style={{ background: isParcial ? 'rgba(139,92,246,0.1)' : '#080C10', borderLeft: '3px solid rgba(139,92,246,0.6)' }}
        >
          <span style={{ color: '#A78BFA' }}>📅 Pagamento Parcial</span>
          <div className="flex items-center gap-2">
            {isParcial && saldoRestante > 0 && (
              <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(139,92,246,0.15)', color: '#A78BFA' }}>
                {numParcelasNum}× {formatCurrency(parcelaValue)}
              </span>
            )}
            {isParcial ? <ChevronUp className="w-3.5 h-3.5" style={{ color: '#4A5568' }} /> : <ChevronDown className="w-3.5 h-3.5" style={{ color: '#4A5568' }} />}
          </div>
        </button>
        {isParcial && (
          <div className="px-3 py-3 space-y-3" style={{ background: '#080C10', borderTop: '1px solid rgba(139,92,246,0.2)' }}>
            <p className="text-xs text-muted-foreground">Informe o valor recebido agora. O saldo restante será dividido em meses subsequentes com aviso automático.</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Valor Recebido (R$)</label>
                <Input
                  type="number"
                  value={valorPago}
                  onChange={e => setValorPago(e.target.value)}
                  placeholder={formatCurrency(totalLiquid)}
                  className="mt-1 bg-background text-foreground"
                  style={{ borderColor: 'rgba(139,92,246,0.4)' }}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Nº de Parcelas</label>
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={numParcelas}
                  onChange={e => setNumParcelas(e.target.value)}
                  className="mt-1 bg-background text-foreground"
                  style={{ borderColor: 'rgba(139,92,246,0.4)' }}
                />
              </div>
            </div>
            {saldoRestante > 0 && parcelaValue > 0 && (
              <div className="rounded-md p-3 space-y-2" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)' }}>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Devido total</span>
                  <span className="font-mono text-foreground">{formatCurrency(totalLiquid)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Recebido agora</span>
                  <span className="font-mono" style={{ color: '#4ADE80' }}>{formatCurrency(valorPagoNum)}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-border pt-2">
                  <span className="text-muted-foreground">Saldo restante</span>
                  <span className="font-mono" style={{ color: '#F43F5E' }}>{formatCurrency(saldoRestante)}</span>
                </div>
                <div className="pt-1 space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Parcelas agendadas:</p>
                  {Array.from({ length: numParcelasNum }, (_, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span style={{ color: '#A78BFA' }}>⚠ {formatMonth(addMonths(form.reference_month, i + 1))}</span>
                      <span className="font-mono" style={{ color: '#A78BFA' }}>+ {formatCurrency(parcelaValue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <PremiumCard glowColor="hsl(43 52% 54%)" className="py-3 px-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground text-center">Total Líquido</p>
        <p className="font-mono text-2xl font-bold mt-1 text-center" style={{ color: '#E8C97A' }}>{formatCurrency(actualTotalLiquid)}</p>
        {(isParcial ? (saldoRestante > 0) : (discount > 0 || surcharge > 0)) && (
          <div className="mt-2 pt-2 border-t border-border space-y-1">
            {isParcial ? (
              <>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Devido total</span>
                  <span className="font-mono">{formatCurrency(totalLiquid)}</span>
                </div>
                <div className="flex justify-between text-xs" style={{ color: '#4ADE80' }}>
                  <span>✓ Recebido</span>
                  <span className="font-mono">{formatCurrency(valorPagoNum)}</span>
                </div>
                <div className="flex justify-between text-xs" style={{ color: '#F43F5E' }}>
                  <span>⚠ Saldo a cobrar</span>
                  <span className="font-mono">{formatCurrency(saldoRestante)}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Bruto − encargos</span>
                  <span className="font-mono">{formatCurrency(rentGross + iptu + celesc + semasa - adm)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-xs" style={{ color: '#F59E0B' }}>
                    <span>− Desconto</span>
                    <span className="font-mono">− {formatCurrency(discount)}</span>
                  </div>
                )}
                {surcharge > 0 && (
                  <div className="flex justify-between text-xs" style={{ color: '#F43F5E' }}>
                    <span>+ Acréscimo</span>
                    <span className="font-mono">+ {formatCurrency(surcharge)}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </PremiumCard>

      <GoldButton onClick={handleSave} disabled={isSaving} className="w-full justify-center">
        {isSaving ? "Salvando..." : isEditMode ? "Atualizar Fechamento" : "Salvar Fechamento"}
      </GoldButton>
    </PremiumCard>
  );
}
