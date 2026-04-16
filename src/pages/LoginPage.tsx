import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { WT7Logo } from "@/components/wt7/WT7Logo";
import { GoldButton } from "@/components/wt7/GoldButton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleForgotPassword = async () => {
    if (!email) {
      toast({ title: "Informe o e-mail", description: "Preencha o campo de e-mail primeiro", variant: "destructive" });
      return;
    }
    setResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada para redefinir a senha." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const userId = authData.user?.id;

      // Verifica role e status
      const { data: roleData } = await (supabase as any)
        .from("user_roles")
        .select("role, status")
        .eq("user_id", userId)
        .maybeSingle();

      // Sem role cadastrada = acesso negado
      if (!roleData) {
        await supabase.auth.signOut();
        toast({ title: "Acesso negado", description: "Usuário sem permissão. Contate o administrador.", variant: "destructive" });
        return;
      }

      const status = (roleData as any).status ?? "active";
      if (status === "pending") {
        await supabase.auth.signOut();
        toast({ title: "Acesso pendente", description: "Aguarde a aprovação do administrador.", variant: "destructive" });
        return;
      }
      if (status === "rejected") {
        await supabase.auth.signOut();
        toast({ title: "Acesso negado", description: "Entre em contato com o administrador.", variant: "destructive" });
        return;
      }

      // Grava histórico de login
      await (supabase as any).from("login_history").insert({
        user_id: userId,
        user_agent: navigator.userAgent,
      });

      // Redireciona por role
      const role = roleData.role;
      if (role === "kitnet_manager") {
        navigate("/manager/kitnets", { replace: true });
      } else if (role === "financial") {
        navigate("/financial/billing", { replace: true });
      } else if (role === "partner") {
        navigate("/partner/projects", { replace: true });
      } else if (role === "commissions") {
        navigate("/commissions/portal", { replace: true });
      } else if (role === "wedding") {
        navigate("/wedding/portal", { replace: true });
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch (err: any) {
      toast({ title: "Erro no login", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#05080C' }}>
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-10">
          <WT7Logo size="lg" />
          <p className="text-sm mt-2" style={{ color: '#94A3B8' }}>
            Sistema Financeiro Pessoal
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          className="rounded-2xl p-8 space-y-5"
          style={{
            background: 'rgba(13,19,24,0.8)',
            backdropFilter: 'blur(20px)',
            border: '1px solid #1A2535',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          }}
        >
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#94A3B8' }}>
              E-mail
            </label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="william@wt7.com"
              className="bg-wt-deep border-wt-border text-wt-text-primary placeholder:text-wt-text-muted focus-visible:ring-gold"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#94A3B8' }}>
              Senha
            </label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-wt-deep border-wt-border text-wt-text-primary placeholder:text-wt-text-muted focus-visible:ring-gold"
              required
            />
          </div>
          <GoldButton type="submit" className="w-full justify-center" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </GoldButton>
          <div className="text-center space-y-1">
            <Button
              type="button"
              variant="link"
              onClick={handleForgotPassword}
              disabled={resetting}
              className="text-xs text-wt-text-muted hover:text-gold"
            >
              {resetting ? "Enviando..." : "Esqueci minha senha"}
            </Button>
            <div>
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="text-xs underline underline-offset-4 transition-colors"
                style={{ color: '#64748B' }}
              >
                Solicitar acesso →
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
