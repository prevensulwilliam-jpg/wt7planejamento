import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PremiumCard } from "@/components/wt7/PremiumCard";
import { WtBadge } from "@/components/wt7/WtBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/formatters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Link as LinkIcon } from "lucide-react";

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
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id, role");
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

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <h1 className="font-display font-bold text-xl text-wt-text-primary">Usuários & Acessos</h1>

      {/* Access links card */}
      <PremiumCard glowColor="rgba(201,168,76,0.2)">
        <div className="flex items-center gap-2 mb-4">
          <LinkIcon className="w-4 h-4" style={{ color: '#E8C97A' }} />
          <h3 className="font-display font-bold text-sm" style={{ color: '#E8C97A' }}>Links de Acesso por Perfil</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {accessLinks.map(l => (
            <div key={l.role} className="flex items-center justify-between rounded-lg px-4 py-2.5" style={{ background: '#080C10', border: '1px solid #1A2535' }}>
              <span className="text-sm font-medium" style={{ color: '#F0F4F8' }}>{l.role}</span>
              <span className="text-xs font-mono" style={{ color: '#94A3B8' }}>{l.url}</span>
            </div>
          ))}
        </div>
      </PremiumCard>

      {/* Info card */}
      <PremiumCard>
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4" style={{ color: '#2DD4BF' }} />
          <h3 className="font-display font-bold text-sm" style={{ color: '#2DD4BF' }}>Criar Novo Acesso</h3>
        </div>
        <p className="text-sm" style={{ color: '#94A3B8' }}>
          Para criar novos usuários, acesse o painel de gerenciamento do backend → Authentication → Users → Add User.
          Após criar o usuário, defina o perfil (role) na tabela <code className="font-mono text-xs" style={{ color: '#E8C97A' }}>user_roles</code>.
        </p>
      </PremiumCard>

      {/* Users table */}
      <PremiumCard>
        <h3 className="font-display font-bold text-sm mb-4" style={{ color: '#F0F4F8' }}>Usuários do Sistema</h3>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" style={{ background: '#131B22' }} />)}
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-12" style={{ color: '#4A5568' }}>
            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow style={{ borderColor: '#1A2535' }}>
                <TableHead style={{ color: '#94A3B8' }}>Nome</TableHead>
                <TableHead style={{ color: '#94A3B8' }}>Perfil</TableHead>
                <TableHead style={{ color: '#94A3B8' }}>Data Criação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((u, i) => {
                const badge = roleBadge[u.role] ?? { variant: 'gray' as const, label: u.role };
                return (
                  <TableRow key={`${u.user_id}-${i}`} style={{ borderColor: '#1A2535' }}>
                    <TableCell style={{ color: '#F0F4F8' }}>{u.name}</TableCell>
                    <TableCell><WtBadge variant={badge.variant}>{badge.label}</WtBadge></TableCell>
                    <TableCell className="font-mono text-xs" style={{ color: '#94A3B8' }}>{u.created_at ? formatDate(u.created_at) : '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </PremiumCard>
    </div>
  );
}
