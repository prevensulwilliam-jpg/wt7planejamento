import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/wt7/DatePicker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssets } from "@/hooks/useFinances";
import { useInvestments, useCreateInvestment, useConsortiums, useCreateConsortium, useCreateAsset } from "@/hooks/useConstructions";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { Landmark, Plus, TrendingUp, Wallet } from "lucide-react";

export default function AssetsPage() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") ?? "bens";
  const { data: assets, isLoading: assetsLoading } = useAssets();
  const { data: investments, isLoading: invLoading } = useInvestments();
  const { data: consortiums, isLoading: consLoading } = useConsortiums();
  const createAsset = useCreateAsset();
  const createInvestment = useCreateInvestment();
  const createConsortium = useCreateConsortium();
  const { toast } = useToast();
  const [assetOpen, setAssetOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [consOpen, setConsOpen] = useState(false);
  const [assetForm, setAssetForm] = useState({ name: "", type: "imovel", estimated_value: "", acquisition_date: "", notes: "" });
  const [invForm, setInvForm] = useState({ name: "", bank: "", type: "CDB", initial_amount: "", current_amount: "", rate_percent: "", maturity_date: "" });
  const [consForm, setConsForm] = useState({ name: "", total_value: "", monthly_payment: "", installments_total: "", installments_paid: "", status: "ativo" });

  const totalPatrimonio = (assets ?? []).reduce((s, a) => s + (a.estimated_value ?? 0), 0);
  const totalInvestido = (investments ?? []).reduce((s, i) => s + (i.initial_amount ?? 0), 0);
  const totalAtualInv = (investments ?? []).reduce((s, i) => s + (i.current_amount ?? 0), 0);
  const rendimento = totalAtualInv - totalInvestido;

  const handleCreateAsset = async () => {
    if (!assetForm.name) return;
    try {
      await createAsset.mutateAsync({ name: assetForm.name, type: assetForm.type, estimated_value: parseFloat(assetForm.estimated_value) || null, acquisition_date: assetForm.acquisition_date || null, notes: assetForm.notes || null });
      toast({ title: "Bem registrado!" }); setAssetOpen(false); setAssetForm({ name: "", type: "imovel", estimated_value: "", acquisition_date: "", notes: "" });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  const handleCreateInv = async () => {
    if (!invForm.name) return;
    try {
      await createInvestment.mutateAsync({ name: invForm.name, bank: invForm.bank, type: invForm.type, initial_amount: parseFloat(invForm.initial_amount) || null, current_amount: parseFloat(invForm.current_amount) || null, rate_percent: parseFloat(invForm.rate_percent) || null, maturity_date: invForm.maturity_date || null });
      toast({ title: "Investimento registrado!" }); setInvOpen(false); setInvForm({ name: "", bank: "", type: "CDB", initial_amount: "", current_amount: "", rate_percent: "", maturity_date: "" });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  const handleCreateCons = async () => {
    if (!consForm.name) return;
    try {
      await createConsortium.mutateAsync({ name: consForm.name, total_value: parseFloat(consForm.total_value) || null, monthly_payment: parseFloat(consForm.monthly_payment) || null, installments_total: parseInt(consForm.installments_total) || null, installments_paid: parseInt(consForm.installments_paid) || 0, status: consForm.status });
      toast({ title: "Consórcio registrado!" }); setConsOpen(false); setConsForm({ name: "", total_value: "", monthly_payment: "", installments_total: "", installments_paid: "", status: "ativo" });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  const inputStyle = { background: '#080C10', border: '1px solid #1A2535', color: '#F0F4F8' };

  return (
    <div className="space-y-6">
      <h1 className="font-display font-bold text-2xl" style={{ color: '#F0F4F8' }}>
        <Landmark className="inline w-6 h-6 mr-2" style={{ color: '#C9A84C' }} />
        Patrimônio
      </h1>

      <KpiCard label="Patrimônio Líquido Total" value={totalPatrimonio + totalAtualInv} color="gold" />

      <Tabs defaultValue={defaultTab}>
        <TabsList style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <TabsTrigger value="bens">Bens</TabsTrigger>
          <TabsTrigger value="investimentos">Investimentos</TabsTrigger>
          <TabsTrigger value="consorcios">Consórcios</TabsTrigger>
        </TabsList>

        <TabsContent value="bens" className="space-y-4">
          <div className="flex justify-end"><GoldButton onClick={() => setAssetOpen(true)}><Plus className="w-4 h-4" />Novo Bem</GoldButton></div>
          {assetsLoading ? <Skeleton className="h-32 rounded-2xl" /> : (assets ?? []).length === 0 ? (
            <PremiumCard><p className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhum bem cadastrado</p></PremiumCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(assets ?? []).map(a => (
                <PremiumCard key={a.id} className="space-y-2">
                  <p className="font-display font-bold" style={{ color: '#F0F4F8' }}>{a.name}</p>
                  <WtBadge variant="gold">{a.type}</WtBadge>
                  <p className="font-mono text-xl" style={{ color: '#E8C97A' }}>{formatCurrency(a.estimated_value ?? 0)}</p>
                  {a.acquisition_date && <p className="text-xs" style={{ color: '#94A3B8' }}>Adquirido: {formatDate(a.acquisition_date)}</p>}
                  {a.notes && <p className="text-xs" style={{ color: '#4A5568' }}>{a.notes}</p>}
                </PremiumCard>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="investimentos" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard label="Total Investido" value={totalInvestido} color="gold" />
            <KpiCard label="Valor Atual" value={totalAtualInv} color="cyan" />
            <KpiCard label="Rendimento" value={rendimento} color="green" />
          </div>
          <div className="flex justify-end"><GoldButton onClick={() => setInvOpen(true)}><Plus className="w-4 h-4" />Nova Aplicação</GoldButton></div>
          {invLoading ? <Skeleton className="h-32 rounded-2xl" /> : (investments ?? []).length === 0 ? (
            <PremiumCard><p className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhum investimento</p></PremiumCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(investments ?? []).map(inv => (
                <PremiumCard key={inv.id} className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div><p className="font-display font-bold" style={{ color: '#F0F4F8' }}>{inv.name}</p><p className="text-xs" style={{ color: '#94A3B8' }}>{inv.bank} · {inv.type}</p></div>
                    <WtBadge variant="cyan">{inv.rate_percent ? `${inv.rate_percent}% a.a.` : "—"}</WtBadge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><p className="text-xs" style={{ color: '#94A3B8' }}>Aplicado</p><p className="font-mono" style={{ color: '#F0F4F8' }}>{formatCurrency(inv.initial_amount ?? 0)}</p></div>
                    <div><p className="text-xs" style={{ color: '#94A3B8' }}>Atual</p><p className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(inv.current_amount ?? 0)}</p></div>
                  </div>
                  <p className="text-xs font-mono" style={{ color: (inv.current_amount ?? 0) >= (inv.initial_amount ?? 0) ? '#10B981' : '#F43F5E' }}>
                    <TrendingUp className="inline w-3 h-3 mr-1" />
                    Rendimento: {formatCurrency((inv.current_amount ?? 0) - (inv.initial_amount ?? 0))}
                  </p>
                  {inv.maturity_date && <p className="text-xs" style={{ color: '#94A3B8' }}>Vencimento: {formatDate(inv.maturity_date)}</p>}
                </PremiumCard>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="consorcios" className="space-y-4">
          <div className="flex justify-end"><GoldButton onClick={() => setConsOpen(true)}><Plus className="w-4 h-4" />Novo Consórcio</GoldButton></div>
          {consLoading ? <Skeleton className="h-32 rounded-2xl" /> : (consortiums ?? []).length === 0 ? (
            <PremiumCard><p className="text-center py-8" style={{ color: '#94A3B8' }}>Nenhum consórcio</p></PremiumCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(consortiums ?? []).map(c => {
                const pct = c.installments_total ? ((c.installments_paid ?? 0) / c.installments_total) * 100 : 0;
                const pago = (c.installments_paid ?? 0) * (c.monthly_payment ?? 0);
                return (
                  <PremiumCard key={c.id} className="space-y-2">
                    <div className="flex items-start justify-between">
                      <p className="font-display font-bold" style={{ color: '#F0F4F8' }}>{c.name}</p>
                      <WtBadge variant={c.status === "contemplado" ? "green" : c.status === "ativo" ? "gold" : "gray"}>{c.status}</WtBadge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div><p className="text-xs" style={{ color: '#94A3B8' }}>Total</p><p className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(c.total_value ?? 0)}</p></div>
                      <div><p className="text-xs" style={{ color: '#94A3B8' }}>Parcela</p><p className="font-mono" style={{ color: '#F0F4F8' }}>{formatCurrency(c.monthly_payment ?? 0)}</p></div>
                      <div><p className="text-xs" style={{ color: '#94A3B8' }}>Pago</p><p className="font-mono" style={{ color: '#10B981' }}>{formatCurrency(pago)}</p></div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs" style={{ color: '#94A3B8' }}><span>{c.installments_paid ?? 0}/{c.installments_total ?? 0} parcelas</span><span>{pct.toFixed(0)}%</span></div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  </PremiumCard>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
        <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>Novo Bem</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label style={{ color: '#94A3B8' }}>Nome</Label><Input value={assetForm.name} onChange={e => setAssetForm({ ...assetForm, name: e.target.value })} style={inputStyle} /></div>
            <div><Label style={{ color: '#94A3B8' }}>Tipo</Label>
              <Select value={assetForm.type} onValueChange={v => setAssetForm({ ...assetForm, type: v })}>
                <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                  {["imovel","terreno","veiculo","aplicacao","consorcio","outros"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label style={{ color: '#94A3B8' }}>Valor Estimado</Label><Input type="number" value={assetForm.estimated_value} onChange={e => setAssetForm({ ...assetForm, estimated_value: e.target.value })} style={inputStyle} /></div>
            <div><Label style={{ color: '#94A3B8' }}>Data Aquisição</Label><DatePicker value={assetForm.acquisition_date} onChange={v => setAssetForm({ ...assetForm, acquisition_date: v })} /></div>
            <div><Label style={{ color: '#94A3B8' }}>Observações</Label><Input value={assetForm.notes} onChange={e => setAssetForm({ ...assetForm, notes: e.target.value })} style={inputStyle} /></div>
          </div>
          <DialogFooter><GoldButton onClick={handleCreateAsset}>Registrar</GoldButton></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={invOpen} onOpenChange={setInvOpen}>
        <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>Nova Aplicação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label style={{ color: '#94A3B8' }}>Nome</Label><Input value={invForm.name} onChange={e => setInvForm({ ...invForm, name: e.target.value })} style={inputStyle} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label style={{ color: '#94A3B8' }}>Banco</Label><Input value={invForm.bank} onChange={e => setInvForm({ ...invForm, bank: e.target.value })} style={inputStyle} /></div>
              <div><Label style={{ color: '#94A3B8' }}>Tipo</Label>
                <Select value={invForm.type} onValueChange={v => setInvForm({ ...invForm, type: v })}>
                  <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                  <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                    {["CDB","LCI","LCA","Tesouro Direto","FII","Ações","Poupança","Outros"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label style={{ color: '#94A3B8' }}>Valor Aplicado</Label><Input type="number" value={invForm.initial_amount} onChange={e => setInvForm({ ...invForm, initial_amount: e.target.value })} style={inputStyle} /></div>
              <div><Label style={{ color: '#94A3B8' }}>Valor Atual</Label><Input type="number" value={invForm.current_amount} onChange={e => setInvForm({ ...invForm, current_amount: e.target.value })} style={inputStyle} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label style={{ color: '#94A3B8' }}>Taxa % a.a.</Label><Input type="number" value={invForm.rate_percent} onChange={e => setInvForm({ ...invForm, rate_percent: e.target.value })} style={inputStyle} /></div>
              <div><Label style={{ color: '#94A3B8' }}>Vencimento</Label><DatePicker value={invForm.maturity_date} onChange={v => setInvForm({ ...invForm, maturity_date: v })} /></div>
            </div>
          </div>
          <DialogFooter><GoldButton onClick={handleCreateInv}>Registrar</GoldButton></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={consOpen} onOpenChange={setConsOpen}>
        <DialogContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <DialogHeader><DialogTitle style={{ color: '#F0F4F8' }}>Novo Consórcio</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label style={{ color: '#94A3B8' }}>Nome</Label><Input value={consForm.name} onChange={e => setConsForm({ ...consForm, name: e.target.value })} style={inputStyle} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label style={{ color: '#94A3B8' }}>Valor Total</Label><Input type="number" value={consForm.total_value} onChange={e => setConsForm({ ...consForm, total_value: e.target.value })} style={inputStyle} /></div>
              <div><Label style={{ color: '#94A3B8' }}>Parcela Mensal</Label><Input type="number" value={consForm.monthly_payment} onChange={e => setConsForm({ ...consForm, monthly_payment: e.target.value })} style={inputStyle} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label style={{ color: '#94A3B8' }}>Total Parcelas</Label><Input type="number" value={consForm.installments_total} onChange={e => setConsForm({ ...consForm, installments_total: e.target.value })} style={inputStyle} /></div>
              <div><Label style={{ color: '#94A3B8' }}>Pagas</Label><Input type="number" value={consForm.installments_paid} onChange={e => setConsForm({ ...consForm, installments_paid: e.target.value })} style={inputStyle} /></div>
            </div>
            <div><Label style={{ color: '#94A3B8' }}>Status</Label>
              <Select value={consForm.status} onValueChange={v => setConsForm({ ...consForm, status: v })}>
                <SelectTrigger style={inputStyle}><SelectValue /></SelectTrigger>
                <SelectContent style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="contemplado">Contemplado</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><GoldButton onClick={handleCreateCons}>Registrar</GoldButton></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
