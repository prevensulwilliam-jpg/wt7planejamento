import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { WT7Logo } from "@/components/wt7/WT7Logo";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, ArrowLeft } from "lucide-react";
import WeddingPage from "@/pages/WeddingPage";

export default function WeddingPortalPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login", { replace: true }); return; }

      // Admin pode acessar qualquer portal
      const { data: adminCheck } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (adminCheck) {
        setIsAdmin(true);
        setAuthorized(true);
        setLoading(false);
        return;
      }

      // Checa role wedding com status active
      const { data: roleData } = await (supabase as any)
        .from("user_roles")
        .select("status")
        .eq("user_id", user.id)
        .eq("role", "wedding")
        .maybeSingle();

      if (!roleData || roleData.status !== "active") {
        navigate("/login", { replace: true });
        return;
      }

      setAuthorized(true);
      setLoading(false);
    })();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#05080C" }}>
        <Skeleton className="w-16 h-16 rounded-2xl" />
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div className="min-h-screen" style={{ background: "#05080C" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 h-14"
        style={{ background: "#080C10", borderBottom: "1px solid #1A2535" }}
      >
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => navigate("/hoje")}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: "#94A3B8", border: "1px solid #1A2535" }}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Hoje
            </button>
          )}
          <WT7Logo size="sm" />
          <span className="font-display font-semibold text-lg" style={{ color: "#EC4899" }}>
            💒 Portal Casamento
          </span>
        </div>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            navigate("/login");
          }}
          className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: "#94A3B8", border: "1px solid #1A2535" }}
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </header>

      {/* Conteúdo — reusa WeddingPage inteira */}
      <main className="max-w-7xl mx-auto p-6">
        <WeddingPage />
      </main>
    </div>
  );
}
