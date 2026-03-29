import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { WT7Logo } from "@/components/wt7/WT7Logo";
import { GoldButton } from "@/components/wt7/GoldButton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Checa sessão já existente (token chegou antes do mount)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    // Escuta eventos futuros
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
      }
    });

    // Fallback: checa hash e query string da URL
    const url = window.location.href;
    if (
      url.includes("type=recovery") ||
      url.includes("access_token") ||
      window.location.hash.includes("type=recovery")
    ) {
      setReady(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "Mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Senha atualizada!", description: "Redirecionando para o login..." });
      await supabase.auth.signOut();
      setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#05080C' }}>
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-10">
          <WT7Logo size="lg" />
          <p className="text-sm mt-2" style={{ color: '#94A3B8' }}>Redefinir Senha</p>
        </div>
        <form
          onSubmit={handleReset}
          className="rounded-2xl p-8 space-y-5"
          style={{
            background: 'rgba(13,19,24,0.8)',
            backdropFilter: 'blur(20px)',
            border: '1px solid #1A2535',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          }}
        >
          {!ready ? (
            <div className="text-center space-y-3">
              <p className="text-sm" style={{ color: '#94A3B8' }}>
                Aguardando verificação do link...
              </p>
              <p className="text-xs" style={{ color: '#64748B' }}>
                Se demorar mais de 5 segundos, clique no link do e-mail novamente.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider" style={{ color: '#94A3B8' }}>
                  Nova Senha
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-wt-deep border-wt-border text-wt-text-primary placeholder:text-wt-text-muted focus-visible:ring-gold"
                  required
                  minLength={6}
                  autoFocus
                />
              </div>
              <GoldButton type="submit" className="w-full justify-center" disabled={loading}>
                {loading ? "Salvando..." : "Salvar Nova Senha"}
              </GoldButton>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
