import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { KpiCard } from "@/components/wt7/KpiCard";
import { GoldButton } from "@/components/wt7/GoldButton";
import { WtBadge } from "@/components/wt7/WtBadge";
import { WT7Logo } from "@/components/wt7/WT7Logo";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProperties, useConstructionExpenses } from "@/hooks/useConstructions";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { LogOut, MapPin } from "lucide-react";

export default function PartnerProjectsPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [userName, setUserName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const navigate = useNavigate();
  const { data: allProperties, isLoading } = useProperties();
  const { data: expenses } = useConstructionExpenses(selectedProjectId);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login", { replace: true }); return; }
      const { data: isPartner } = await supabase.rpc("has_role", { _user_id: user.id, _role: "partner" });
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isPartner && !isAdmin) { navigate("/login", { replace: true }); return; }
      const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
      setUserName(profile?.name ?? user.email ?? "");
      setAuthorized(true);
    })();
  }, [navigate]);

  if (authorized === null) return <div className="min-h-screen flex items-center justify-center" style={{ background: '#080C10' }}><Skeleton className="w-16 h-16 rounded-2xl" /></div>;

  const properties = (allProperties ?? []).filter(p => p.partner_name && userName.toLowerCase().includes(p.partner_name.toLowerCase()));

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/login"); };

  const totalExpenses = (expenses ?? []).reduce((s, e) => s + (e.total_amount ?? 0), 0);
  const partnerExpenses = (expenses ?? []).reduce((s, e) => s + (e.partner_amount ?? 0), 0);
  const williamExpenses = (expenses ?? []).reduce((s, e) => s + (e.william_amount ?? 0), 0);

  const selectedProp = properties.find(p => p.id === selectedProjectId);
  const futureRent = selectedProp ? (selectedProp.total_units_planned ?? 0) * (selectedProp.estimated_rent_per_unit ?? 0) * ((selectedProp.partner_pct ?? 50) / 100) : 0;
  const roiAnnual = partnerExpenses > 0 ? (futureRent * 12 / partnerExpenses) * 100 : 0;
  const paybackMonths = futureRent > 0 ? Math.ceil(partnerExpenses / futureRent) : 0;

  return (
    <div className="min-h-screen" style={{ background: '#080C10' }}>
      <header className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #1A2535' }}>
        <div className="flex items-center gap-3">
          <WT7Logo />
          <span className="font-display font-bold text-lg" style={{ color: '#8B5CF6' }}>Portal do Sócio — {userName}</span>
        </div>
        <GoldButton variant="outline" onClick={handleLogout}><LogOut className="w-4 h-4" />Sair</GoldButton>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {isLoading ? <Skeleton className="h-48 rounded-2xl" /> : properties.length === 0 ? (
          <PremiumCard><p className="text-center py-12" style={{ color: '#94A3B8' }}>Nenhum projeto vinculado ao seu perfil</p></PremiumCard>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {properties.map(p => {
                const progress = p.total_units_planned ? ((p.total_units_built ?? 0) / p.total_units_planned) * 100 : 0;
                return (
                  <PremiumCard key={p.id} className="cursor-pointer space-y-3" glowColor={selectedProjectId === p.id ? '#8B5CF6' : undefined} onClick={() => setSelectedProjectId(p.id)}>
                    <p className="font-display font-bold text-lg" style={{ color: '#F0F4F8' }}>{p.code} — {p.name}</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}><MapPin className="inline w-3 h-3 mr-1" />{p.address}, {p.city}</p>
                    <WtBadge variant="cyan">{p.status}</WtBadge>
                    {(p.total_units_planned ?? 0) > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs" style={{ color: '#94A3B8' }}>Unidades: {p.total_units_built ?? 0}/{p.total_units_planned}</p>
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}
                    <p className="text-xs" style={{ color: '#8B5CF6' }}>Sua participação: {p.partner_pct}%</p>
                  </PremiumCard>
                );
              })}
            </div>

            {selectedProjectId && (
              <div className="space-y-4">
                <h2 className="font-display font-bold text-xl" style={{ color: '#F0F4F8' }}>Financeiro — {selectedProp?.code}</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <KpiCard label="Total Investido" value={totalExpenses} color="gold" />
                  <KpiCard label="Sua Parte" value={partnerExpenses} color="cyan" />
                  <KpiCard label="Parte William" value={williamExpenses} color="green" />
                </div>

                <PremiumCard>
                  <Table>
                    <TableHeader><TableRow style={{ borderColor: '#1A2535' }}>
                      {["Data", "Descrição", "Total", "Sua Parte", "William"].map(h => <TableHead key={h} style={{ color: '#94A3B8' }}>{h}</TableHead>)}
                    </TableRow></TableHeader>
                    <TableBody>
                      {(expenses ?? []).length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-8" style={{ color: '#94A3B8' }}>Sem despesas</TableCell></TableRow>
                      ) : (expenses ?? []).map(e => (
                        <TableRow key={e.id} style={{ borderColor: '#1A2535' }}>
                          <TableCell style={{ color: '#CBD5E1' }}>{e.expense_date ? formatDate(e.expense_date) : "—"}</TableCell>
                          <TableCell style={{ color: '#F0F4F8' }}>{e.description}</TableCell>
                          <TableCell className="font-mono" style={{ color: '#E8C97A' }}>{formatCurrency(e.total_amount ?? 0)}</TableCell>
                          <TableCell className="font-mono" style={{ color: '#8B5CF6' }}>{formatCurrency(e.partner_amount ?? 0)}</TableCell>
                          <TableCell className="font-mono" style={{ color: '#2DD4BF' }}>{formatCurrency(e.william_amount ?? 0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </PremiumCard>

                <PremiumCard glowColor="#8B5CF6" className="space-y-3">
                  <h3 className="font-display font-bold" style={{ color: '#8B5CF6' }}>📊 Projeção</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><p className="text-xs" style={{ color: '#94A3B8' }}>Renda Futura (sua parte)</p><p className="font-mono text-lg" style={{ color: '#E8C97A' }}>{formatCurrency(futureRent)}/mês</p></div>
                    <div><p className="text-xs" style={{ color: '#94A3B8' }}>ROI Anual</p><p className="font-mono text-lg" style={{ color: '#2DD4BF' }}>{roiAnnual.toFixed(1)}%</p></div>
                    <div><p className="text-xs" style={{ color: '#94A3B8' }}>Payback</p><p className="font-mono text-lg" style={{ color: '#F0F4F8' }}>{paybackMonths} meses</p></div>
                    <div><p className="text-xs" style={{ color: '#94A3B8' }}>Previsão Conclusão</p><p className="font-mono text-lg" style={{ color: '#F0F4F8' }}>{selectedProp?.estimated_completion ? formatDate(selectedProp.estimated_completion) : "—"}</p></div>
                  </div>
                </PremiumCard>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
