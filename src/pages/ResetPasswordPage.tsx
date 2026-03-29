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
    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    // Also check hash for type=recovery
    if (window.location.hash.includes("type=recovery")) {
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
      toast({ title: "Senha atualizada!", description: "Redirecionando..." });
      setTimeout(() => navigate("/dashboard", { replace: true }), 1500);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-wt-deep">
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-10">
          <WT7Logo size="lg" />
          <p className="text-sm mt-2 text-wt-text-muted">Redefinir Senha</p>
        </div>
        <form
          onSubmit={handleReset}
          className="rounded-2xl p-8 space-y-5"
          style={{
            background: 'rgba(13,19,24,0.8)',
            backdropFilter: 'blur(20px)',
            border: '1px solid hsl(var(--wt-border))',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          }}
        >
          {!ready ? (
            <p className="text-wt-text-muted text-center text-sm">
              Aguardando verificação do link de recuperação...
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-wt-text-muted">
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
