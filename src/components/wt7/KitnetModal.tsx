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
  useLastEnergyReading,
  useCelescInvoices,
} from "@/hooks/useKitnets";
import { formatCurrency, formatMonth, getCurrentMonth } from "@/lib/formatters";
import { Upload, FileText, Trash2, Plus, Zap } from "lucide-react";
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
}

export function KitnetModal({ kitnet, onClose, onUpdated }: Props) {
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
          <TabsContent value="dados"><DadosTab kitnet={kitnet} onUpdated={onUpdated} /></TabsContent>
          <TabsContent value="contrato"><ContratoTab kitnet={kitnet} onUpdated={onUpdated} /></TabsContent>
          <TabsContent value="fechamentos"><FechamentosTab kitnet={kitnet} /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ─── ABA DADOS ───
function DadosTab({ kitnet, onUpdated }: { kitnet: Tables<"kitnets">; onUpdated: () => void }) {
  const { toast } = useToast();
  const updateMut = useUpdateKitnet();
  const [form, setForm] = useState({
    tenant_name: kitnet.tenant_name ?? "",
    tenant_phone: kitnet.tenant_phone ?? "",
    rent_value: String(kitnet.rent_value ?? ""),
    status: kitnet.status ?? "vacant",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    try {
      await updateMut.mutateAsync({
        id: kitnet.id,
        tenant_name: form.tenant_name || null,
        tenant_phone: form.tenant_phone || null,
        rent_value: Number(form.rent_value) || null,
        status: form.status,
      });
      toast({ title: "Dados salvos!" });
      onUpdated();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 mt-4">
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
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</label>
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
      <GoldButton onClick={handleSave} disabled={updateMut.isPending} className="w-full justify-center">
        {updateMut.isPending ? "Salvando..." : "Salvar Dados"}
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
function FechamentosTab({ kitnet }: { kitnet: Tables<"kitnets"> }) {
  const { data: fechamentos, isLoading } = useKitnetFechamentos(kitnet.id);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <GoldButton onClick={() => setShowForm(v => !v)}>
          <Plus className="w-4 h-4 mr-1" />
          {showForm ? "Cancelar" : "Novo Fechamento"}
        </GoldButton>
      </div>

      {showForm && <FechamentoForm kitnet={kitnet} onSaved={() => setShowForm(false)} />}

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : !fechamentos?.length ? (
        <PremiumCard className="text-center py-8">
          <p className="text-muted-foreground text-sm">Nenhum fechamento registrado</p>
        </PremiumCard>
      ) : (
        <div className="space-y-2">
          {fechamentos.map((f: any) => (
            <PremiumCard key={f.id} className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{f.reference_month ? formatMonth(f.reference_month) : "—"}</p>
                <p className="text-xs text-muted-foreground">
                  Bruto: {formatCurrency(f.rent_gross ?? 0)} | ADM: {formatCurrency(f.adm_fee ?? 0)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-lg" style={{ color: '#E8C97A' }}>{formatCurrency(f.total_liquid ?? 0)}</p>
                <p className="text-xs text-muted-foreground">líquido</p>
              </div>
            </PremiumCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FORM NOVO FECHAMENTO ───
function FechamentoForm({ kitnet, onSaved }: { kitnet: Tables<"kitnets">; onSaved: () => void }) {
  const { toast } = useToast();
  const createMut = useCreateKitnetEntry();
  const [month] = useState(getCurrentMonth());
  const { data: lastReading } = useLastEnergyReading(kitnet.id);
  const { data: invoices } = useCelescInvoices(month);

  const [form, setForm] = useState({
    period_start: "",
    period_end: "",
    rent_gross: String(kitnet.rent_value ?? 0),
    iptu_taxa: "0",
    celesc: "0",
    semasa: "0",
    adm_fee: String(((kitnet.rent_value ?? 0) * 0.1).toFixed(2)),
    reference_month: month,
  });
  const [celescMode, setCelescMode] = useState<"idle" | "loading" | "found" | "manual">("idle");
  const [celescFoundInfo, setCelescFoundInfo] = useState<{ kwh: number; amount: number; tariff: number } | null>(null);
  const [readingCurrent, setReadingCurrent] = useState("");

  const tariff = invoices?.find(i => i.residencial_code === kitnet.residencial_code)?.tariff_per_kwh ?? 1.06;
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
  const totalLiquid = rentGross + iptu + celesc + semasa - adm;

  useEffect(() => {
    setForm(f => ({ ...f, adm_fee: (rentGross * 0.1).toFixed(2) }));
  }, [rentGross]);

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await createMut.mutateAsync({
        kitnet_id: kitnet.id,
        reference_month: form.reference_month,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        rent_gross: rentGross,
        iptu_taxa: iptu,
        celesc: celesc,
        semasa: semasa,
        adm_fee: adm,
        total_liquid: totalLiquid,
        created_by: user?.id,
      });
      toast({ title: "Fechamento salvo!" });
      onSaved();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <PremiumCard className="p-4 space-y-3 border border-[#E8C97A]/20">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Novo Fechamento</p>

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

      <PremiumCard glowColor="hsl(43 52% 54%)" className="text-center py-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Líquido</p>
        <p className="font-mono text-2xl font-bold mt-1" style={{ color: '#E8C97A' }}>{formatCurrency(totalLiquid)}</p>
      </PremiumCard>

      <GoldButton onClick={handleSave} disabled={createMut.isPending} className="w-full justify-center">
        {createMut.isPending ? "Salvando..." : "Salvar Fechamento"}
      </GoldButton>
    </PremiumCard>
  );
}
