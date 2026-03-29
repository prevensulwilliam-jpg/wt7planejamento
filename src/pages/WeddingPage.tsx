import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWeddingInstallments, useUpdateWeddingInstallment } from "@/hooks/useConstructions";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import { Heart, Check, Clock, PartyPopper, CalendarDays } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const WEDDING_DATE = new Date("2027-12-11");
const TOTAL_CONTRACTED = 98110;
const TOTAL_BUDGET = 170000;
const RESERVA = 19622;

const suppliers = [
  { service: "Buffet/Jantar", supplier: "Villa Sonali", status: "incluido_pacote", value: 0 },
  { service: "Decoração cerimônia", supplier: "", status: "a_contratar", value: 12000 },
  { service: "Tenda cobertura deck", supplier: "", status: "a_contratar", value: 5000 },
  { service: "Estrutura espelhada piscina", supplier: "", status: "a_contratar", value: 4500 },
  { service: "Gerador", supplier: "", status: "a_contratar", value: 1000 },
  { service: "Lembrancinhas", supplier: "", status: "a_contratar", value: 1000 },
  { service: "Bolo", supplier: "", status: "a_contratar", value: 2500 },
  { service: "Bolo fake", supplier: "", status: "a_contratar", value: 150 },
  { service: "Docinhos", supplier: "", status: "a_contratar", value: 5000 },
  { service: "Bar alcoólico", supplier: "Villa Sonali", status: "incluido_pacote", value: 11970 },
  { service: "Espumantes", supplier: "", status: "noivos_trazem", value: 3000 },
  { service: "Whisky", supplier: "", status: "noivos_trazem", value: 2000 },
  { service: "Iluminação", supplier: "", status: "a_contratar", value: 3000 },
  { service: "Celebrante", supplier: "", status: "a_contratar", value: 1000 },
  { service: "Banda/Música jantar", supplier: "", status: "a_contratar", value: 2000 },
  { service: "DJ (Luka)", supplier: "Villa Sonali", status: "incluido_pacote", value: 0 },
  { service: "Cerimonialista (Chris Martini)", supplier: "Villa Sonali", status: "incluido_pacote", value: 0 },
  { service: "Fotografia/Video", supplier: "", status: "a_contratar", value: 0 },
];

const statusBadge: Record<string, { label: string; variant: "green" | "cyan" | "gold" | "gray" }> = {
  incluido_pacote: { label: "No Pacote", variant: "green" },
  contratado: { label: "Contratado", variant: "cyan" },
  a_contratar: { label: "A Contratar", variant: "gold" },
  noivos_trazem: { label: "Noivos", variant: "gray" },
};

const milestones = [
  { done: true, label: "Reserva data", date: "31/12/2025" },
  { done: false, label: "Degustação cardápio", date: "até jun/2027" },
  { done: false, label: "Definir decoração", date: "até ago/2027" },
  { done: false, label: "Contratar fotógrafo", date: "até dez/2026" },
  { done: false, label: "Contratar banda/DJ extras", date: "até dez/2026" },
  { done: false, label: "Confirmar lista convidados", date: "até out/2027" },
  { done: false, label: "Início parcelas", date: "jan/2027" },
  { done: false, label: "Casamento", date: "11/12/2027", highlight: true },
];

export default function WeddingPage() {
  const { data: installments, isLoading } = useWeddingInstallments();
  const updateInstallment = useUpdateWeddingInstallment();
  const { toast } = useToast();

  const daysUntil = Math.ceil((WEDDING_DATE.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const totalPaid = (installments ?? []).filter(i => i.status === "pago").reduce((s, i) => s + (i.amount ?? 0), 0);
  const totalPending = TOTAL_CONTRACTED - totalPaid;
  const aContratar = TOTAL_BUDGET - TOTAL_CONTRACTED;

  const chartData = [
    { name: "Villa Sonali (Pago)", value: totalPaid, color: "#10B981" },
    { name: "Villa Sonali (Pendente)", value: totalPending, color: "#C9A84C" },
    { name: "Extras a Contratar", value: aContratar, color: "#2DD4BF" },
  ];

  const handleMarkPaid = async (id: string) => {
    try {
      await updateInstallment.mutateAsync({ id, status: "pago", paid_at: new Date().toISOString().split("T")[0] });
      toast({ title: "Pagamento registrado!" });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display font-bold text-2xl" style={{ color: '#F0F4F8' }}>
          <Heart className="inline w-6 h-6 mr-2" style={{ color: '#EC4899' }} />
          Casamento 2027
        </h1>
        <PremiumCard glowColor="#EC4899" className="px-4 py-2">
          <p className="font-mono text-sm" style={{ color: '#EC4899' }}>🎉 Faltam <strong>{daysUntil}</strong> dias!</p>
        </PremiumCard>
      </div>

      <Tabs defaultValue="financeiro">
        <TabsList style={{ background: '#0D1318', border: '1px solid #1A2535' }}>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
          <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard label="Total Pago" value={totalPaid} color="green" />
            <KpiCard label="Pendente (Villa)" value={totalPending} color="gold" />
            <KpiCard label="A Contratar (extras)" value={aContratar} color="cyan" />
            <KpiCard label="Orçamento Total" value={TOTAL_BUDGET} color="gold" />
          </div>

          <PremiumCard className="space-y-3">
            <h3 className="font-display font-bold" style={{ color: '#F0F4F8' }}>Villa Sonali — Contrato</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs" style={{ color: '#94A3B8' }}>Total Contratado</p><p className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(TOTAL_CONTRACTED)}</p></div>
              <div><p className="text-xs" style={{ color: '#94A3B8' }}>Reserva (31/12/2025)</p><p className="font-mono" style={{ color: '#10B981' }}>{formatCurrency(RESERVA)} ✅</p></div>
              <div><p className="text-xs" style={{ color: '#94A3B8' }}>Parcelas</p><p className="font-mono" style={{ color: '#F0F4F8' }}>10x R$ 7.848,80</p></div>
              <div><p className="text-xs" style={{ color: '#94A3B8' }}>Período</p><p className="font-mono" style={{ color: '#F0F4F8' }}>jan/27 a out/27</p></div>
            </div>
          </PremiumCard>

          <PremiumCard>
            <h3 className="font-display font-bold mb-3" style={{ color: '#F0F4F8' }}>Distribuição do Orçamento</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} layout="vertical">
                <XAxis type="number" tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} stroke="#4A5568" />
                <YAxis type="category" dataKey="name" width={180} stroke="#94A3B8" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: '#0D1318', border: '1px solid #1A2535' }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </PremiumCard>

          <PremiumCard>
            <h3 className="font-display font-bold mb-3" style={{ color: '#F0F4F8' }}>Parcelas</h3>
            {isLoading ? <Skeleton className="h-32" /> : (
              <div className="space-y-2">
                {(installments ?? []).map(inst => (
                  <div key={inst.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: inst.status === "pago" ? 'rgba(16,185,129,0.08)' : 'rgba(201,168,76,0.05)', border: '1px solid #1A2535' }}>
                    <div className="flex items-center gap-3">
                      {inst.status === "pago" ? <Check className="w-4 h-4" style={{ color: '#10B981' }} /> : <Clock className="w-4 h-4" style={{ color: '#C9A84C' }} />}
                      <span style={{ color: '#F0F4F8' }} className="text-sm">{inst.description}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-sm" style={{ color: '#E8C97A' }}>{formatCurrency(inst.amount ?? 0)}</span>
                      <span className="text-xs" style={{ color: '#94A3B8' }}>{inst.due_date ? formatDate(inst.due_date) : ""}</span>
                      {inst.status !== "pago" && <GoldButton className="text-xs py-1 px-2" onClick={() => handleMarkPaid(inst.id)}>Pagar</GoldButton>}
                    </div>
                  </div>
                ))}
                {(installments ?? []).length === 0 && <p className="text-center py-4 text-sm" style={{ color: '#94A3B8' }}>Nenhuma parcela cadastrada. Adicione via banco de dados.</p>}
              </div>
            )}
          </PremiumCard>
        </TabsContent>

        <TabsContent value="fornecedores" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard label="Contratado / No Pacote" value={suppliers.filter(s => s.status === "incluido_pacote" || s.status === "contratado").reduce((sum, s) => sum + s.value, 0)} color="green" />
            <KpiCard label="A Contratar" value={suppliers.filter(s => s.status === "a_contratar").reduce((sum, s) => sum + s.value, 0)} color="gold" />
            <KpiCard label="Noivos Trazem" value={suppliers.filter(s => s.status === "noivos_trazem").reduce((sum, s) => sum + s.value, 0)} color="gray" />
          </div>
          <PremiumCard>
            <Table>
              <TableHeader><TableRow style={{ borderColor: '#1A2535' }}>
                {["Serviço", "Fornecedor", "Status", "Valor Estimado"].map(h => <TableHead key={h} style={{ color: '#94A3B8' }}>{h}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {suppliers.map((s, i) => {
                  const badge = statusBadge[s.status];
                  return (
                    <TableRow key={i} style={{ borderColor: '#1A2535' }}>
                      <TableCell style={{ color: '#F0F4F8' }}>{s.service}</TableCell>
                      <TableCell style={{ color: '#CBD5E1' }}>{s.supplier || "—"}</TableCell>
                      <TableCell><WtBadge variant={badge.variant}>{badge.label}</WtBadge></TableCell>
                      <TableCell className="font-mono" style={{ color: '#E8C97A' }}>{s.value > 0 ? formatCurrency(s.value) : "Incluso"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </PremiumCard>
        </TabsContent>

        <TabsContent value="cronograma" className="space-y-4">
          <PremiumCard className="space-y-4">
            <h3 className="font-display font-bold" style={{ color: '#F0F4F8' }}>Timeline</h3>
            <div className="relative pl-6 space-y-4">
              <div className="absolute left-2 top-0 bottom-0 w-px" style={{ background: '#1A2535' }} />
              {milestones.map((m, i) => (
                <div key={i} className="relative flex items-start gap-3">
                  <div className="absolute -left-4 w-3 h-3 rounded-full mt-1" style={{ background: m.done ? '#10B981' : m.highlight ? '#EC4899' : '#C9A84C', border: '2px solid #080C10' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: m.highlight ? '#EC4899' : '#F0F4F8' }}>
                      {m.done ? '✅' : m.highlight ? '🎉' : '⏳'} {m.label}
                    </p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>{m.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </PremiumCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
