import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { WT7Logo } from "@/components/wt7/WT7Logo";
import { GoldButton } from "@/components/wt7/GoldButton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // Redirect handled by App.tsx auth listener
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
        </form>
      </div>
    </div>
  );
}
