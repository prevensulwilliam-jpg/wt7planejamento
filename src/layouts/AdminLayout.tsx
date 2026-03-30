import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AdminSidebar } from "@/components/wt7/AdminSidebar";
import { NavalChat } from "@/components/wt7/NavalChat";
import { Menu, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen" style={{ background: '#080C10' }}>
      {/* Mobile menu */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 z-50 flex items-center px-4" style={{ background: '#080C10', borderBottom: '1px solid #1A2535' }}>
        <button onClick={() => setCollapsed(c => !c)} className="text-wt-text-secondary">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Sidebar - hidden on mobile unless toggled */}
      <div className={`hidden lg:block`}>
        <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      </div>

      {/* Main content */}
      <main
        className="transition-all duration-300 min-h-screen pt-14 lg:pt-0"
        style={{ marginLeft: collapsed ? 64 : 240 }}
      >
        {/* Topbar */}
        <header className="hidden lg:flex items-center justify-end h-14 px-6" style={{ borderBottom: '1px solid #1A2535' }}>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-wt-text-muted hover:text-wt-text-secondary transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
      <WiselyChat />
    </div>
  );
}
