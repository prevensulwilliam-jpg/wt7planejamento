import { useState, useMemo, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GoldButton } from "@/components/wt7/GoldButton";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useKitnets, useCelescInvoices, useCreateCelescInvoice, useUpdateCelescInvoice, useEnergyReadings, useSaveEnergyReadings, useEnergyConfig, useUpdateEnergyTariff, useEnergyReadingsSummary } from "@/hooks/useKitnets";
import { formatCurrency, formatMonth, getCurrentMonth } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Save, Upload, Pencil, Sparkles, Loader2, X } from "lucide-react";

export default function EnergyPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display font-bold text-2xl text-foreground">Energia Solar</h1>
      <Tabs defaultValue="invoices">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="invoices">Faturas CELESC</TabsTrigger>
          <TabsTrigger value="readings">Leituras & Cobrança</TabsTrigger>
          <TabsTrigger value="balancete">Balancete</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices"><InvoicesTab /></TabsContent>
        <TabsContent value="readings"><ReadingsTab /></TabsContent>
        <TabsContent value="balancete"><BalanceteTab /></TabsContent>
      </Tabs>
    </div>
  );
}

const EMPTY_FORM = {
  residencial_code: "RWT02",
  reference_month: getCurrentMonth(),
  due_date: "",
  kwh_total: "",
  invoice_total: "",
  cosip: "0",
  pis_cofins_pct: "0",
  icms_pct: "0",
  solar_kwh_offset: "0",
  amount_paid: "",
};

// ─── Invoices Tab ───
function InvoicesTab() {
  const { data: invoices, isLoading } = useCelescInvoices();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mode, setMode] = useState<"upload" | "manual">("upload");
  const [extracting, setExtracting] = useState(false);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const createMut = useCreateCelescInvoice();
  const updateMut = useUpdateCelescInvoice();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);

  const invoiceTotal = Number(form.invoice_total) || 0;
  const cosip = Number(form.cosip) || 0;
  const kwhTotal = Number(form.kwh_total) || 0;
  const tariff = kwhTotal > 0 ? (invoiceTotal - cosip) / kwhTotal : 0;

  const handleOpen = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setPreviewFile(null);
    setMode("upload");
    setOpen(true);
  };

  const handleEdit = (inv: any) => {
    setForm({
      residencial_code: inv.residencial_code ?? "RWT02",
      reference_month: inv.reference_month ?? getCurrentMonth(),
      due_date: inv.due_date ?? "",
      kwh_total: String(inv.kwh_total ?? ""),
      invoice_total: String(inv.invoice_total ?? ""),
      cosip: String(inv.cosip ?? "0"),
      pis_cofins_pct: String(inv.pis_cofins_pct ?? "0"),
      icms_pct: String(inv.icms_pct ?? "0"),
      solar_kwh_offset: String(inv.solar_kwh_offset ?? "0"),
      amount_paid: String(inv.amount_paid ?? ""),
    });
    setEditingId(inv.id);
    setPreviewFile(null);
    setMode("manual");
    setOpen(true);
  };

  // Convert file to base64 and call edge function
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Formato inválido", description: "Use JPG, PNG, WEBP ou PDF", variant: "destructive" });
      return;
    }

    // Show preview for images
    if (file.type !== "application/pdf") {
      setPreviewFile(URL.createObjectURL(file));
    } else {
      setPreviewFile("pdf");
    }

    setExtracting(true);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const base64 = (ev.target?.result as string).split(",")[1];
        const mediaType = file.type; // keep original type (application/pdf or image/*)

        const { data: json, error: fnError } = await supabase.functions.invoke("wisely-ai", {
          body: { action: "extract-celesc", imageBase64: base64, mediaType },
        });

        if (fnError) throw new Error(fnError.message);
        if (!json?.ok) throw new Error(json?.error || "Erro na extração");

        const d = json.data;
        setForm(f => ({
          ...f,
          reference_month: d.reference_month ?? f.reference_month,
          due_date: d.due_date ?? f.due_date,
          kwh_total: d.kwh_total != null ? String(d.kwh_total) : f.kwh_total,
          invoice_total: d.invoice_total != null ? String(d.invoice_total) : f.invoice_total,
          cosip: d.cosip != null ? String(d.cosip) : f.cosip,
          pis_cofins_pct: d.pis_cofins_pct != null ? String(d.pis_cofins_pct) : f.pis_cofins_pct,
          icms_pct: d.icms_pct != null ? String(d.icms_pct) : f.icms_pct,
          solar_kwh_offset: d.solar_kwh_offset != null ? String(d.solar_kwh_offset) : f.solar_kwh_offset,
          amount_paid: d.amount_paid != null ? String(d.amount_paid) : f.amount_paid,
        }));

        toast({ title: "✅ Dados extraídos!", description: "Confira e ajuste se necessário." });
        setMode("manual");
      } catch (err: any) {
        toast({ title: "Erro na extração", description: err.message, variant: "destructive" });
        setMode("manual");
      } finally {
        setExtracting(false);
      }
    };
    reader.onerror = () => {
      toast({ title: "Erro ao ler arquivo", variant: "destructive" });
      setExtracting(false);
      setMode("manual");
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        residencial_code: form.residencial_code,
        reference_month: form.reference_month,
        due_date: form.due_date || null,
        kwh_total: kwhTotal,
        invoice_total: invoiceTotal,
        cosip: cosip,
        pis_cofins_pct: Number(form.pis_cofins_pct) || 0,
        icms_pct: Number(form.icms_pct) || 0,
        solar_kwh_offset: Number(form.solar_kwh_offset) || 0,
        amount_paid: Number(form.amount_paid) || 0,
        tariff_per_kwh: Number(tariff.toFixed(6)),
      };
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, ...payload });
        toast({ title: "Fatura atualizada!" });
      } else {
        await createMut.mutateAsync({ ...payload, created_by: user?.id });
        toast({ title: "Fatura salva!" });
      }
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <GoldButton onClick={handleOpen}><Plus className="w-4 h-4 mr-1" />Nova Fatura</GoldButton>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded" />)}</div>
      ) : !invoices?.length ? (
        <PremiumCard className="text-center py-12">
          <p className="text-muted-foreground">Nenhuma fatura cadastrada</p>
        </PremiumCard>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-muted-foreground">Complexo</TableHead>
                <TableHead className="text-muted-foreground">Mês</TableHead>
                <TableHead className="text-muted-foreground">kWh</TableHead>
                <TableHead className="text-muted-foreground">Total Fatura</TableHead>
                <TableHead className="text-muted-foreground">Solar kWh</TableHead>
                <TableHead className="text-muted-foreground">Pago</TableHead>
                <TableHead className="text-muted-foreground">Tarifa/kWh</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map(inv => (
                <TableRow key={inv.id} className="border-border">
                  <TableCell className="font-mono text-foreground">{inv.residencial_code}</TableCell>
                  <TableCell className="text-muted-foreground">{inv.reference_month ? formatMonth(inv.reference_month) : "—"}</TableCell>
                  <TableCell className="font-mono text-foreground">{inv.kwh_total ?? 0}</TableCell>
                  <TableCell className="font-mono text-foreground">{formatCurrency(inv.invoice_total ?? 0)}</TableCell>
                  <TableCell className="font-mono text-foreground">{inv.solar_kwh_offset ?? 0}</TableCell>
                  <TableCell className="font-mono text-foreground">{formatCurrency(inv.amount_paid ?? 0)}</TableCell>
                  <TableCell className="font-mono text-foreground">R$ {(inv.tariff_per_kwh ?? 0).toFixed(4)}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleEdit(inv)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border hover:border-[#E8C97A]/50"
                    >
                      <Pencil className="w-3 h-3" /> Editar
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* New Invoice Dialog */}
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-foreground">{editingId ? "Editar Fatura CELESC" : "Nova Fatura CELESC"}</DialogTitle></DialogHeader>

          {/* Mode toggle */}
          <div className="flex rounded-lg overflow-hidden border border-border">
            <button
              onClick={() => setMode("upload")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${mode === "upload" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              style={{ background: mode === "upload" ? 'rgba(201,168,76,0.12)' : 'transparent' }}
            >
              <Sparkles className="w-4 h-4" /> Upload com IA
            </button>
            <button
              onClick={() => setMode("manual")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${mode === "manual" ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              style={{ background: mode === "manual" ? 'rgba(201,168,76,0.12)' : 'transparent' }}
            >
              <Pencil className="w-4 h-4" /> Manual
            </button>
          </div>

          {/* Upload mode */}
          {mode === "upload" && (
            <div>
              {extracting ? (
                <PremiumCard className="text-center py-10 space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#E8C97A]" />
                  <p className="text-sm text-foreground font-medium">Analisando com IA...</p>
                  <p className="text-xs text-muted-foreground">Extraindo dados da fatura</p>
                </PremiumCard>
              ) : previewFile ? (
                <div className="space-y-3">
                  {previewFile !== "pdf" && (
                    <img src={previewFile} alt="Fatura" className="w-full rounded-lg border border-border max-h-48 object-contain" />
                  )}
                  {previewFile === "pdf" && (
                    <PremiumCard className="text-center py-4">
                      <p className="text-sm text-muted-foreground">PDF carregado — aguarde a extração</p>
                    </PremiumCard>
                  )}
                  <button onClick={() => { setPreviewFile(null); if (fileRef.current) fileRef.current.value = ""; }} className="text-xs text-muted-foreground hover:text-foreground underline">
                    Trocar arquivo
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} />
                  <PremiumCard className="p-8 text-center border-dashed hover:border-[#E8C97A]/50 transition-colors cursor-pointer">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-foreground font-medium">Arraste ou clique para enviar</p>
                    <p className="text-xs text-muted-foreground mt-1">Foto ou PDF da fatura CELESC</p>
                    <p className="text-xs text-muted-foreground">A IA preenche os campos automaticamente</p>
                  </PremiumCard>
                </label>
              )}
            </div>
          )}

          <div className="space-y-3">
            {/* Complexo selector always visible */}
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Complexo</label>
              <Select value={form.residencial_code} onValueChange={v => set("residencial_code", v)}>
                <SelectTrigger className="bg-background border-border text-foreground"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RWT02">RWT02</SelectItem>
                  <SelectItem value="RWT03">RWT03</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Form fields — always shown (editable after auto-fill) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mês Referência</label>
                <Input type="month" value={form.reference_month} onChange={e => set("reference_month", e.target.value)} className="bg-background border-border text-foreground font-mono" />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Vencimento</label>
                <Input type="date" value={form.due_date} onChange={e => set("due_date", e.target.value)} className="bg-background border-border text-foreground" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">kWh Total</label>
                <Input type="number" value={form.kwh_total} onChange={e => set("kwh_total", e.target.value)} className="bg-background border-border text-foreground" />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor Total Fatura</label>
                <Input type="number" value={form.invoice_total} onChange={e => set("invoice_total", e.target.value)} className="bg-background border-border text-foreground" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">COSIP</label>
                <Input type="number" value={form.cosip} onChange={e => set("cosip", e.target.value)} className="bg-background border-border text-foreground" />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">% PIS/COFINS</label>
                <Input type="number" value={form.pis_cofins_pct} onChange={e => set("pis_cofins_pct", e.target.value)} className="bg-background border-border text-foreground" />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">% ICMS</label>
                <Input type="number" value={form.icms_pct} onChange={e => set("icms_pct", e.target.value)} className="bg-background border-border text-foreground" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">kWh Solar Abatido</label>
                <Input type="number" value={form.solar_kwh_offset} onChange={e => set("solar_kwh_offset", e.target.value)} className="bg-background border-border text-foreground" />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Valor Pago</label>
                <Input type="number" value={form.amount_paid} onChange={e => set("amount_paid", e.target.value)} className="bg-background border-border text-foreground" />
              </div>
            </div>

            {/* Calculated tariff */}
            <PremiumCard glowColor="hsl(43 52% 54%)" className="text-center py-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Tarifa Calculada R$/kWh</p>
              <p className="font-mono text-2xl font-bold mt-1" style={{ color: '#E8C97A' }}>R$ {tariff.toFixed(4)}</p>
              <p className="text-xs text-muted-foreground mt-1">(Total - COSIP) ÷ kWh</p>
            </PremiumCard>
          </div>
          <DialogFooter>
            <GoldButton onClick={handleSave} disabled={createMut.isPending || updateMut.isPending} className="w-full justify-center">
              {(createMut.isPending || updateMut.isPending) ? "Salvando..." : editingId ? "Salvar Alterações" : "Salvar Fatura"}
            </GoldButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Readings Tab ───
function ReadingsTab() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [complex, setComplex] = useState("RWT02");
  const { data: kitnets } = useKitnets();
  const { data: invoices } = useCelescInvoices(month);
  const { data: existingReadings } = useEnergyReadings(month, complex);
  const { data: energyConfig } = useEnergyConfig();
  const updateTariff = useUpdateEnergyTariff();
  const saveMut = useSaveEnergyReadings();
  const { toast } = useToast();

  // Tarifa vem da config (padrão 1.06), não da fatura CELESC
  const configEntry = useMemo(() => (energyConfig ?? []).find(c => c.residencial_code === complex), [energyConfig, complex]);
  const tariff = configEntry?.tariff_kwh ?? 1.06;
  const [tariffEdit, setTariffEdit] = useState<string>("");

  // Sync tariffEdit quando muda de complexo
  useMemo(() => { setTariffEdit(String(configEntry?.tariff_kwh ?? 1.06)); }, [configEntry]);

  const handleSaveTariff = async () => {
    const val = Number(tariffEdit);
    if (!val || val <= 0) return;
    try {
      await updateTariff.mutateAsync({ residencial_code: complex, tariff_kwh: val });
      toast({ title: "Tarifa atualizada!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const units = useMemo(() => (kitnets ?? []).filter(k => k.residencial_code === complex), [kitnets, complex]);
  const [readings, setReadings] = useState<Record<string, string>>({});

  useMemo(() => {
    const map: Record<string, string> = {};
    (existingReadings ?? []).forEach((r: any) => { if (r.kitnet_id) map[r.kitnet_id] = String(r.reading_current ?? ""); });
    setReadings(map);
  }, [existingReadings]);

  const getPreviousReading = (kitnetId: string) => {
    const existing = (existingReadings ?? []).find((r: any) => r.kitnet_id === kitnetId);
    return existing?.reading_previous ?? 0;
  };

  const calculateRow = (kitnetId: string) => {
    const current = Number(readings[kitnetId]) || 0;
    const previous = getPreviousReading(kitnetId);
    const kwh = Math.max(0, current - previous);
    return { current, previous, kwh, amount: kwh * tariff };
  };

  const totals = useMemo(() => {
    let totalCharged = 0;
    units.forEach(u => { totalCharged += calculateRow(u.id).amount; });
    const invoicePaid = (invoices ?? []).find(i => i.residencial_code === complex)?.amount_paid ?? 0;
    return { totalCharged, invoicePaid, margin: totalCharged - invoicePaid };
  }, [units, readings, invoices, complex, tariff]);

  const handleSave = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const invoiceId = (invoices ?? []).find(i => i.residencial_code === complex)?.id;
      const toSave = units.map(u => {
        const { current, previous, kwh, amount } = calculateRow(u.id);
        const existing = (existingReadings ?? []).find((r: any) => r.kitnet_id === u.id);
        return {
          ...(existing?.id ? { id: existing.id } : {}),
          kitnet_id: u.id, reference_month: month,
          reading_current: current, reading_previous: previous,
          consumption_kwh: kwh, amount_to_charge: Number(amount.toFixed(2)),
          tariff_per_kwh: tariff, celesc_invoice_id: invoiceId ?? null, created_by: user?.id,
        };
      });
      await saveMut.mutateAsync(toSave as any);
      toast({ title: "Leituras salvas!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-44 bg-background border-border text-foreground font-mono" />
        <Select value={complex} onValueChange={setComplex}>
          <SelectTrigger className="w-36 bg-background border-border text-foreground"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="RWT02">RWT02</SelectItem>
            <SelectItem value="RWT03">RWT03</SelectItem>
          </SelectContent>
        </Select>

        {/* Tarifa editável — só admin vê este bloco */}
        <div className="flex items-center gap-2 ml-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider whitespace-nowrap">Tarifa R$/kWh</label>
          <Input
            type="number"
            step="0.0001"
            value={tariffEdit}
            onChange={e => setTariffEdit(e.target.value)}
            className="w-24 bg-background border-border text-foreground font-mono text-sm"
          />
          <GoldButton onClick={handleSaveTariff} disabled={updateTariff.isPending} className="h-9 px-3 text-xs">
            <Save className="w-3 h-3 mr-1" />Salvar tarifa
          </GoldButton>
        </div>

        <div className="ml-auto">
          <GoldButton onClick={handleSave} disabled={saveMut.isPending}>
            <Save className="w-4 h-4 mr-1" />{saveMut.isPending ? "Salvando..." : "Salvar Leituras"}
          </GoldButton>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground">Unidade</TableHead>
              <TableHead className="text-muted-foreground">Inquilino</TableHead>
              <TableHead className="text-muted-foreground">Anterior</TableHead>
              <TableHead className="text-muted-foreground">Atual</TableHead>
              <TableHead className="text-muted-foreground">kWh</TableHead>
              <TableHead className="text-muted-foreground">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map(u => {
              const { previous, kwh, amount } = calculateRow(u.id);
              return (
                <TableRow key={u.id} className="border-border">
                  <TableCell className="font-mono text-foreground">{u.code}</TableCell>
                  <TableCell className="text-muted-foreground">{u.tenant_name || "—"}</TableCell>
                  <TableCell className="font-mono text-muted-foreground">{previous}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={readings[u.id] ?? ""}
                      onChange={e => setReadings(r => ({ ...r, [u.id]: e.target.value }))}
                      className="w-24 bg-background border-border text-foreground font-mono"
                    />
                  </TableCell>
                  <TableCell className="font-mono text-foreground">{kwh}</TableCell>
                  <TableCell className="font-mono text-foreground">{formatCurrency(amount)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Total Cobrado Inquilinos" value={totals.totalCharged} color="gold" />
        <KpiCard label="Total Pago CELESC" value={totals.invoicePaid} color="red" />
        <KpiCard label="Margem Solar" value={totals.margin} color="green" />
      </div>
    </div>
  );
}

// ─── Balancete Tab ───
const COMPLEXOS = [
  { code: "RWT02", label: "RWT02 — R. Amauri de Souza" },
  { code: "RWT03", label: "RWT03 — R. Manoel Corrêa" },
];

function BalanceteTab() {
  const [month, setMonth] = useState(getCurrentMonth());
  const { data: invoices } = useCelescInvoices(month);
  const { data: summary } = useEnergyReadingsSummary(month);

  const rows = COMPLEXOS.map(({ code, label }) => {
    const fatura = (invoices ?? []).find(i => i.residencial_code === code)?.amount_paid ?? 0;
    const cobrado = summary?.[code] ?? 0;
    const saldo = cobrado - fatura;
    return { code, label, fatura, cobrado, saldo };
  });

  const totalSaldo = rows.reduce((acc, r) => acc + r.saldo, 0);

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center gap-3">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Mês</label>
        <Input
          type="month"
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="w-44 bg-background border-border text-foreground font-mono"
        />
      </div>

      <div className="space-y-4">
        {rows.map(({ code, label, fatura, cobrado, saldo }) => (
          <PremiumCard key={code} className="overflow-hidden p-0">
            {/* Header */}
            <div className="px-5 py-3 border-b border-border">
              <p className="font-mono font-semibold text-foreground text-sm">{label}</p>
            </div>
            {/* Rows */}
            <div className="divide-y divide-border">
              <div className="flex justify-between items-center px-5 py-3">
                <span className="text-sm text-muted-foreground">Valor da Fatura CELESC</span>
                <span className="font-mono font-semibold text-sm" style={{ color: '#F43F5E' }}>
                  {formatCurrency(fatura)}
                </span>
              </div>
              <div className="flex justify-between items-center px-5 py-3">
                <span className="text-sm text-muted-foreground">Valor Cobrado Inquilinos</span>
                <span className="font-mono font-semibold text-sm text-foreground">
                  {formatCurrency(cobrado)}
                </span>
              </div>
              <div className="flex justify-between items-center px-5 py-3">
                <span className="text-sm font-medium text-foreground">Saldo Energia Solar</span>
                <span className="font-mono font-bold text-sm" style={{ color: '#22C55E' }}>
                  {formatCurrency(saldo)}
                </span>
              </div>
            </div>
          </PremiumCard>
        ))}

        {/* Total */}
        <PremiumCard glowColor="hsl(43 52% 54%)" className="px-5 py-4">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-foreground uppercase tracking-wider text-sm">Saldo Total</span>
            <span className="font-mono font-bold text-2xl" style={{ color: '#E8C97A' }}>
              {formatCurrency(totalSaldo)}
            </span>
          </div>
        </PremiumCard>
      </div>
    </div>
  );
}
