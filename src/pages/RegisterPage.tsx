import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { WT7Logo } from "@/components/wt7/WT7Logo";
import { GoldButton } from "@/components/wt7/GoldButton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle } from "lucide-react";

const ROLES = [
  { value: "kitnet_manager", label: "🏠 Portal Manager", description: "Gestão de kitnets e repasses" },
  { value: "commissions", label: "📊 Portal Comissões", description: "Lançamento e visualização de comissões" },
  { value: "partner", label: "🤝 Sócio", description: "Acompanhamento de projetos e participações" },
  { value: "financial", label: "💰 Financeiro", description: "Visualização de faturamento" },
];

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
      toast({ title: "Selecione o perfil desejado", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Senhas diferentes", description: "Confirme a senha corretamente.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Senha fraca", description: "Mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // 1. Cria o usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) throw new Error("Usuário não criado.");

      // 2. Insere role via função SECURITY DEFINER (bypassa RLS)
const { error: roleError } = await (supabase as any)
        .rpc("request_manager_access", { p_user_id: userId, p_role: role });
      if (roleError) throw roleError;

      // 3. Garante logout — não deve ficar autenticado enquanto pendente
      await supabase.auth.signOut();

      setDone(true);
    } catch (err: any) {
      toast({ title: "Erro no cadastro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const cardStyle = {
    background: 'rgba(13,19,24,0.8)',
    backdropFilter: 'blur(20px)',
    border: '1px solid #1A2535',
    boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
  };

  const selectedRole = ROLES.find(r => r.value === role);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#05080C' }}>
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-10">
          <WT7Logo size="lg" />
          <p className="text-sm mt-2" style={{ color: '#94A3B8' }}>Solicitar Acesso</p>
        </div>

        {done ? (
          <div className="rounded-2xl p-8 text-center space-y-4" style={cardStyle}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: 'rgba(34,197,94,0.15)' }}>
              <CheckCircle className="w-7 h-7" style={{ color: '#22C55E' }} />
            </div>
            <h2 className="font-display font-bold text-lg" style={{ color: '#F0F4F8' }}>Solicitação enviada!</h2>
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              Seu cadastro foi recebido e está aguardando aprovação do administrador.
              Você receberá acesso assim que for aprovado.
            </p>
            {selectedRole && (
              <div className="rounded-xl px-4 py-2 mt-2" style={{ background: '#080C10', border: '1px solid #1A2535' }}>
                <p className="text-xs" style={{ color: '#64748B' }}>Perfil solicitado</p>
                <p className="text-sm font-medium mt-0.5" style={{ color: '#E8C97A' }}>{selectedRole.label}</p>
              </div>
            )}
            <button
              onClick={() => navigate("/login")}
              className="text-sm underline underline-offset-4 mt-2"
              style={{ color: '#E8C97A' }}
            >
              ← Voltar ao login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl p-8 space-y-5" style={cardStyle}>
            <div>
              <h2 className="font-display font-bold text-lg text-center" style={{ color: '#F0F4F8' }}>
                Solicitar Acesso
              </h2>
              <p className="text-xs text-center mt-1" style={{ color: '#94A3B8' }}>
                O acesso será liberado após aprovação do administrador.
              </p>
            </div>

            {/* Seletor de perfil */}
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#94A3B8' }}>
                Perfil desejado
              </label>
              <div className="space-y-2">
                {ROLES.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className="w-full text-left rounded-xl px-4 py-3 transition-all"
                    style={{
                      background: role === r.value ? 'rgba(232,201,122,0.1)' : '#080C10',
                      border: `1px solid ${role === r.value ? 'rgba(232,201,122,0.5)' : '#1A2535'}`,
                    }}
                  >
                    <p className="text-sm font-medium" style={{ color: role === r.value ? '#E8C97A' : '#F0F4F8' }}>
                      {r.label}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{r.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#94A3B8' }}>Nome</label>
              <Input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Seu nome completo"
                className="bg-wt-deep border-wt-border text-wt-text-primary placeholder:text-wt-text-muted"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#94A3B8' }}>E-mail</label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="bg-wt-deep border-wt-border text-wt-text-primary placeholder:text-wt-text-muted"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#94A3B8' }}>Senha</label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="bg-wt-deep border-wt-border text-wt-text-primary placeholder:text-wt-text-muted"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#94A3B8' }}>Confirmar Senha</label>
              <Input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repita a senha"
                className="bg-wt-deep border-wt-border text-wt-text-primary placeholder:text-wt-text-muted"
                required
              />
            </div>

            <GoldButton type="submit" className="w-full justify-center" disabled={loading || !role}>
              {loading ? "Enviando..." : "Solicitar Acesso"}
            </GoldButton>

            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="text-xs underline underline-offset-4"
                style={{ color: '#64748B' }}
              >
                ← Voltar ao login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
