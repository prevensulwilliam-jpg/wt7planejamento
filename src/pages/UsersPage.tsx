import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { WtBadge } from "@/components/wt7/WtBadge";
import { MonthPicker } from "@/components/wt7/MonthPicker";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/formatters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Link as LinkIcon, Trash2, AlertTriangle, Clock, CheckCircle, XCircle, Bell, Copy, Check } from "lucide-react";
import { usePendingUsers, useApproveUser, useRejectUser, useLoginHistory, useDeleteUser } from "@/hooks/useUsers";

const roleBadge: Record<string, { variant: 'gold' | 'green' | 'cyan' | 'gray'; label: string }> = {
  admin: { variant: 'gold', label: 'Admin' },
  kitnet_manager: { variant: 'cyan', label: 'Adm Kitnets' },
  financial: { variant: 'green', label: 'Financeiro' },
  partner: { variant: 'gray', label: 'Sócio' },
};

const accessLinks = [
  { role: 'Admin', url: 'wt7planejamento.lovable.app/dashboard' },
  { role: 'Adm Kitnets', url: 'wt7planejamento.lovable.app/manager/kitnets' },
  { role: 'Financeiro', url: 'wt7planejamento.lovable.app/financial/billing' },
  { role: 'Sócio', url: 'wt7planejamento.lovable.app/partner/projects' },
];

function useUsersWithRoles() {
  return useQuery({
    queryKey: ["users_with_roles"],
    queryFn: async () => {
      const { data: roles, error: rolesErr } = await (supabase as any)
        .from("user_roles")
        .select("user_id, role, status")
        .eq("status", "active");
      if (rolesErr) throw rolesErr;

      const userIds = [...new Set((roles ?? []).map(r => r.user_id))];
      if (userIds.length === 0) return [];

      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, name, created_at")
        .in("id", userIds);
      if (profErr) throw profErr;

      return (roles ?? []).map(r => {
        const profile = (profiles ?? []).find(p => p.id === r.user_id);
        return {
          user_id: r.user_id,
          role: r.role,
          name: profile?.name ?? '—',
          created_at: profile?.created_at,
        };
      });
    },
  });
}

export default function UsersPage() {
  const { data = [], isLoading } = useUsersWithRoles();
  const { data: pending = [] } = usePendingUsers();
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText("https://" + url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };
  const approveMut = useApproveUser();
  const rejectMut = useRejectUser();
  const deleteMut = useDeleteUser();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [historyUserId, setHistoryUserId] = useState<string>("");
  const { data: loginHistory = [] } = useLoginHistory(historyUserId || undefined);
  const [cleaning, setCleaning] = useState(false);
  const [confirm2, setConfirm2] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [cleaningPeriod, setCleaningPeriod] = useState(false);
  const [confirm3, setConfirm3] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [cleaningDups, setCleaningDups] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const cleanDemoData = async () => {
    setCleaning(true);
    try {
      const { data: matchedRevenues } = await supabase
        .from("bank_transactions")
        .select("matched_revenue_id")
        .not("matched_revenue_id", "is", null);

      const { data: matchedExpenses } = await supabase
        .from("bank_transactions")
        .select("matched_expense_id")
        .not("matched_expense_id", "is", null);

      const safeRevenueIds = (matchedRevenues ?? [])
        .map((r: any) => r.matched_revenue_id)
        .filter(Boolean);

      const safeExpenseIds = (matchedExpenses ?? [])
        .map((r: any) => r.matched_expense_id)
        .filter(Boolean);

      let revenueQuery = supabase.from("revenues").delete();
      if (safeRevenueIds.length > 0) {
        revenueQuery = revenueQuery.not("id", "in", `(${safeRevenueIds.join(",")})`);
      }
      const { error: revError } = await revenueQuery.neq("id", "00000000-0000-0000-0000-000000000000");

      let expenseQuery = supabase.from("expenses").delete();
      if (safeExpenseIds.length > 0) {
        expenseQuery = expenseQuery.not("id", "in", `(${safeExpenseIds.join(",")})`);
      }
      const { error: expError } = await expenseQuery.neq("id", "00000000-0000-0000-0000-000000000000");

      if (revError || expError) {
        throw new Error(revError?.message ?? expError?.message);
      }

      qc.invalidateQueries({ queryKey: ["revenues"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });

      toast({
        title: "Dados de demonstração removidos",
        description: "Receitas e despesas manuais apagadas. Apenas dados de extrato permanecem.",
      });
      setConfirm2(false);
    } catch (err: any) {
      toast({ title: "Erro ao limpar", description: err.message, variant: "destructive" });
    } finally {
      setCleaning(false);
    }
  };

  const cleanPeriodData = async () => {
    if (!periodStart || !periodEnd) {
      toast({ title: "Selecione o período", variant: "destructive" });
      return;
    }
    setCleaningPeriod(true);
    try {
      const { count: revCount } = await supabase
        .from("revenues")
        .delete({ count: "exact" })
        .gte("reference_month", periodStart)
        .lte("reference_month", periodEnd);

      const { count: expCount } = await supabase
        .from("expenses")
        .delete({ count: "exact" })
        .gte("reference_month", periodStart)
        .lte("reference_month", periodEnd);

      const startDate = `${periodStart}-01`;
      const [y, m] = periodEnd.split("-");
      const endDate = new Date(+y, +m, 0).toISOString().split("T")[0];
      const { count: txCount } = await supabase
        .from("bank_transactions")
        .delete({ count: "exact" })
        .gte("date", startDate)
        .lte("date", endDate);

      qc.invalidateQueries({ queryKey: ["revenues"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["bank_transactions"] });

      toast({
        title: "Lançamentos removidos",
        description: `${revCount ?? 0} receitas · ${expCount ?? 0} despesas · ${txCount ?? 0} transações bancárias apagadas do período.`,
      });
      setConfirm3(false);
      setPeriodOpen(false);
      setPeriodStart("");
      setPeriodEnd("");
    } catch (err: any) {
      toast({ title: "Erro ao limpar período", description: err.message, variant: "destructive" });
    } finally {
      setCleaningPeriod(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <h1 className="font-display font-bold text-xl text-wt-text-primary">Usuários & Acessos</h1>

      {/* ── Aprovações Pendentes ── */}
      <PremiumCard glowColor={pending.length > 0 ? "rgba(232,201,122,0.25)" : undefined}>
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4" style={{ color: '#E8C97A' }} />
          <h3 className="font-display font-bold text-sm" style={{ color: '#E8C97A' }}>Aprovações Pendentes</h3>
          {pending.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgba(232,201,122,0.2)', color: '#E8C97A' }}>
              {pending.length}
            </span>
          )}
        </div>
        {pending.length === 0 ? (
          <p className="text-sm" style={{ color: '#64748B' }}>Nenhuma solicitação pendente.</p>
        ) : (
          <div className="space-y-3">
            {pending.map(u => (
              <div key={u.user_id} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: '#080C10', border: '1px solid rgba(232,201,122,0.2)' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#F0F4F8' }}>{u.name}</p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: '#64748B' }}>
                    {roleBadge[u.role]?.label ?? u.role} · Solicitado em {u.requested_at ? new Date(u.requested_at).toLocaleDateString("pt-BR") : "—"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => approveMut.mutate(u.user_id)}
                    disabled={approveMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', border: '1px solid rgba(34,197,94,0.3)' }}
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Aprovar
                  </button>
                  <button
                    onClick={() => rejectMut.mutate(u.user_id)}
                    disabled={rejectMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.25)' }}
                  >
                    <XCircle className="w-3.5 h-3.5" /> Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </PremiumCard>

      {/* ── Histórico de Acessos ── */}
      <PremiumCard>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4" style={{ color: '#2DD4BF' }} />
          <h3 className="font-display font-bold text-sm" style={{ color: '#2DD4BF' }}>Histórico de Acessos</h3>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <Select value={historyUserId || "__all__"} onValueChange={v => setHistoryUserId(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-56 bg-background border-border text-foreground">
              <SelectValue placeholder="Selecionar usuário..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os usuários</SelectItem>
              {data.filter(u => u.role !== "admin").map((u, i) => (
                <SelectItem key={`${u.user_id}-${i}`} value={u.user_id}>{u.name || u.user_id.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs" style={{ color: '#64748B' }}>{loginHistory.length} registro(s)</span>
        </div>
        {loginHistory.length === 0 ? (
          <p className="text-sm" style={{ color: '#64748B' }}>Nenhum acesso registrado.</p>
        ) : (
          <div className="rounded-xl overflow-hidden border border-border">
            <Table>
              <TableHeader>
                <TableRow style={{ borderColor: '#1A2535' }}>
                  {!historyUserId && <TableHead style={{ color: '#94A3B8' }}>Usuário</TableHead>}
                  <TableHead style={{ color: '#94A3B8' }}>Data</TableHead>
                  <TableHead style={{ color: '#94A3B8' }}>Hora</TableHead>
                  <TableHead style={{ color: '#94A3B8' }}>Navegador</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loginHistory.slice(0, 50).map(h => {
                  const dt = new Date(h.logged_at);
                  const user = data.find(u => u.user_id === h.user_id);
                  const ua = h.user_agent ?? "";
                  const browser = ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Safari") ? "Safari" : ua.includes("Edge") ? "Edge" : "—";
                  return (
                    <TableRow key={h.id} style={{ borderColor: '#1A2535' }}>
                      {!historyUserId && <TableCell style={{ color: '#F0F4F8' }}>{user?.name ?? h.user_id.slice(0, 8)}</TableCell>}
                      <TableCell className="font-mono text-xs" style={{ color: '#94A3B8' }}>{dt.toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="font-mono text-xs" style={{ color: '#94A3B8' }}>{dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                      <TableCell className="text-xs" style={{ color: '#64748B' }}>{browser}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </PremiumCard>

      {/* Access links card */}
      <PremiumCard glowColor="rgba(201,168,76,0.2)">
        <div className="flex items-center gap-2 mb-4">
          <LinkIcon className="w-4 h-4" style={{ color: '#E8C97A' }} />
          <h3 className="font-display font-bold text-sm" style={{ color: '#E8C97A' }}>Links de Acesso por Perfil</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {accessLinks.map(l => (
            <div key={l.role} className="flex items-center justify-between rounded-lg px-4 py-2.5 gap-3" style={{ background: '#080C10', border: '1px solid #1A2535' }}>
              <span className="text-sm font-medium shrink-0" style={{ color: '#F0F4F8' }}>{l.role}</span>
              <span className="text-xs font-mono truncate" style={{ color: '#94A3B8' }}>{l.url}</span>
              <button
                onClick={() => handleCopy(l.url)}
                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all"
                style={{
                  background: copiedUrl === l.url ? 'rgba(34,197,94,0.15)' : 'rgba(232,201,122,0.1)',
                  color: copiedUrl === l.url ? '#22C55E' : '#E8C97A',
                  border: `1px solid ${copiedUrl === l.url ? 'rgba(34,197,94,0.3)' : 'rgba(232,201,122,0.25)'}`,
                }}
                title="Copiar link"
              >
                {copiedUrl === l.url ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          ))}
        </div>
      </PremiumCard>

      {/* Users by role */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" style={{ background: '#131B22' }} />)}
        </div>
      ) : (
        <>
          {[
            { role: "admin", icon: "👑", title: "Administradores", color: "#E8C97A" },
            { role: "kitnet_manager", icon: "🏠", title: "Portal Manager", color: "#2DD4BF" },
            { role: "partner", icon: "🤝", title: "Sócios", color: "#94A3B8" },
            { role: "financial", icon: "💰", title: "Financeiro", color: "#22C55E" },
          ].map(group => {
            const users = data.filter(u => u.role === group.role);
            if (users.length === 0) return null;
            return (
              <PremiumCard key={group.role}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-base">{group.icon}</span>
                  <h3 className="font-display font-bold text-sm" style={{ color: group.color }}>{group.title}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(148,163,184,0.1)', color: '#64748B' }}>{users.length}</span>
                </div>
                <div className="space-y-2">
                  {users.map((u, i) => {
                    const badge = roleBadge[u.role] ?? { variant: 'gray' as const, label: u.role };
                    const isAdmin = u.role === "admin";
                    return (
                      <div key={`${u.user_id}-${i}`} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: '#080C10', border: '1px solid #1A2535' }}>
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-sm font-medium" style={{ color: '#F0F4F8' }}>{u.name}</p>
                            <p className="text-xs font-mono mt-0.5" style={{ color: '#64748B' }}>
                              Desde {u.created_at ? formatDate(u.created_at) : '—'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <WtBadge variant={badge.variant}>{badge.label}</WtBadge>
                          {!isAdmin && (
                            confirmDelete === u.user_id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    deleteMut.mutate(u.user_id, {
                                      onSuccess: () => {
                                        toast({ title: "Usuário excluído" });
                                        setConfirmDelete(null);
                                      },
                                      onError: (err: any) => {
                                        toast({ title: "Erro", description: err.message, variant: "destructive" });
                                      },
                                    });
                                  }}
                                  disabled={deleteMut.isPending}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                                  style={{ background: '#F43F5E', color: '#fff' }}
                                >
                                  {deleteMut.isPending ? "..." : "Confirmar"}
                                </button>
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  className="px-2.5 py-1 rounded-lg text-xs transition-all"
                                  style={{ color: '#94A3B8', border: '1px solid #1A2535' }}
                                >
                                  Não
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDelete(u.user_id)}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all hover:opacity-80"
                                style={{ background: 'rgba(244,63,94,0.1)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.2)' }}
                                title="Excluir usuário"
                              >
                                <Trash2 className="w-3 h-3" /> Excluir
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </PremiumCard>
            );
          })}
        </>
      )}

      {/* Zona de Perigo */}
      <PremiumCard glowColor="rgba(244,63,94,0.15)">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(244,63,94,0.15)' }}>
            <AlertTriangle className="w-5 h-5" style={{ color: '#F43F5E' }} />
          </div>
          <div>
            <h3 className="font-display font-bold text-sm" style={{ color: '#F43F5E' }}>Zona de Perigo</h3>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Ações irreversíveis</p>
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ background: '#080C10', border: '1px solid rgba(244,63,94,0.2)' }}>
          <h4 className="font-display font-bold text-sm mb-1" style={{ color: '#F0F4F8' }}>
            <Trash2 className="w-4 h-4 inline mr-1.5" style={{ color: '#F43F5E' }} />
            Limpar dados de demonstração
          </h4>
          <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>
            Remove todas as receitas e despesas inseridas manualmente ou como exemplo.
            Mantém apenas os dados que vieram dos seus extratos bancários via conciliação.
            <strong style={{ color: '#F43F5E' }}> Esta ação não pode ser desfeita.</strong>
          </p>

          {!confirm2 ? (
            <button
              onClick={() => setConfirm2(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: 'rgba(244,63,94,0.15)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.3)' }}
            >
              Limpar dados de demonstração
            </button>
          ) : (
            <div className="rounded-lg p-3" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.3)' }}>
              <p className="text-xs font-medium mb-3" style={{ color: '#F43F5E' }}>
                ⚠️ Tem certeza absoluta? Isso apagará TODAS as receitas e despesas que não vieram de extrato.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={cleanDemoData}
                  disabled={cleaning}
                  className="px-4 py-2 rounded-lg text-sm font-bold transition-all"
                  style={{ background: '#F43F5E', color: '#fff' }}
                >
                  {cleaning ? "Apagando..." : "Sim, apagar tudo"}
                </button>
                <button
                  onClick={() => setConfirm2(false)}
                  className="px-4 py-2 rounded-lg text-sm transition-all"
                  style={{ color: '#94A3B8', border: '1px solid #1A2535' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
        {/* SEGUNDO CARD DE PERIGO — limpar período */}
        <div className="rounded-xl p-4 mt-4" style={{ background: '#080C10', border: '1px solid rgba(244,63,94,0.2)' }}>
          <h4 className="font-display font-bold text-sm mb-1" style={{ color: '#F0F4F8' }}>
            <Trash2 className="w-4 h-4 inline mr-1.5" style={{ color: '#F43F5E' }} />
            Limpar lançamentos por período
          </h4>
          <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>
            Remove <strong style={{ color: '#F0F4F8' }}>receitas, despesas e transações bancárias</strong> de um período específico.
            Não afeta contas bancárias, aplicações, consórcios, casamento, kitnets, obras, patrimônio, metas, impostos, categorias ou padrões IA.
            <strong style={{ color: '#F43F5E' }}> Irreversível.</strong>
          </p>

          {!periodOpen ? (
            <button
              onClick={() => setPeriodOpen(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: 'rgba(244,63,94,0.15)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.3)' }}
            >
              Selecionar período para limpar
            </button>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Mês inicial</label>
                  <MonthPicker
                    value={periodStart}
                    onChange={v => { setPeriodStart(v); setConfirm3(false); }}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs font-mono uppercase mb-1 block" style={{ color: '#94A3B8' }}>Mês final</label>
                  <MonthPicker
                    value={periodEnd}
                    onChange={v => { setPeriodEnd(v); setConfirm3(false); }}
                    className="w-full"
                  />
                </div>
              </div>

              {periodStart && periodEnd && periodStart <= periodEnd && !confirm3 && (
                <div className="rounded-lg p-3" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)' }}>
                  <p className="text-sm" style={{ color: '#F0F4F8' }}>
                    Será apagado tudo de{" "}
                    <strong style={{ color: '#F43F5E' }}>
                      {new Date(periodStart + "-01").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                    </strong>
                    {" "}até{" "}
                    <strong style={{ color: '#F43F5E' }}>
                      {new Date(periodEnd + "-01").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                    </strong>:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {["Receitas", "Despesas", "Transações bancárias (extrato)"].map(item => (
                      <li key={item} className="text-xs flex items-center gap-2" style={{ color: '#94A3B8' }}>
                        <span style={{ color: '#F43F5E' }}>✕</span> {item}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => setConfirm3(true)}
                    className="mt-3 px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
                    style={{ background: 'rgba(244,63,94,0.2)', color: '#F43F5E', border: '1px solid rgba(244,63,94,0.4)' }}
                  >
                    Confirmar limpeza
                  </button>
                </div>
              )}

              {confirm3 && (
                <div className="rounded-lg p-3" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.4)' }}>
                  <p className="text-xs font-medium mb-3" style={{ color: '#F43F5E' }}>
                    ⚠️ Última confirmação — isso não pode ser desfeito.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={cleanPeriodData}
                      disabled={cleaningPeriod}
                      className="px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                      style={{ background: '#F43F5E', color: '#fff' }}
                    >
                      {cleaningPeriod ? "Apagando..." : "Sim, apagar o período"}
                    </button>
                    <button
                      onClick={() => { setConfirm3(false); setPeriodOpen(false); setPeriodStart(""); setPeriodEnd(""); }}
                      className="px-4 py-2 rounded-lg text-sm transition-all"
                      style={{ color: '#94A3B8', border: '1px solid #1A2535' }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {!confirm3 && (
                <button
                  onClick={() => { setPeriodOpen(false); setPeriodStart(""); setPeriodEnd(""); }}
                  className="text-xs transition-all"
                  style={{ color: '#64748B' }}
                >
                  ← Cancelar
                </button>
              )}
            </div>
          )}
        </div>

        {/* TERCEIRO CARD — limpar duplicatas */}
        <div className="rounded-xl p-4 mt-4" style={{ background: '#080C10', border: '1px solid rgba(244,63,94,0.2)' }}>
          <h4 className="font-display font-bold text-sm mb-1" style={{ color: '#F0F4F8' }}>
            <Trash2 className="w-4 h-4 inline mr-1.5" style={{ color: '#F59E0B' }} />
            Limpar duplicatas de receitas/despesas
          </h4>
          <p className="text-xs mb-3" style={{ color: '#94A3B8' }}>
            Remove registros duplicados (mesma descrição, mês, valor e categoria), mantendo o mais antigo.
            Útil após re-importações ou recategorizações que geraram duplicatas.
          </p>
          <button
            onClick={async () => {
              setCleaningDups(true);
              try {
                await supabase.rpc("clean_duplicate_revenues" as any);
                await supabase.rpc("clean_duplicate_expenses" as any);
                qc.invalidateQueries({ queryKey: ["revenues"] });
                qc.invalidateQueries({ queryKey: ["expenses"] });
                toast({ title: "Duplicatas removidas!", description: "Receitas e despesas duplicadas foram limpas." });
              } catch (err: any) {
                toast({ title: "Erro", description: err.message, variant: "destructive" });
              } finally {
                setCleaningDups(false);
              }
            }}
            disabled={cleaningDups}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            {cleaningDups ? "Limpando..." : "🧹 Limpar duplicatas"}
          </button>
        </div>
      </PremiumCard>
    </div>
  );
}
